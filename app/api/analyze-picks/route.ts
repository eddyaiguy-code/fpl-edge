import { NextResponse } from 'next/server';
import { FPLData, FPLFixture, ProcessedPlayer } from '@/types/fpl';
import analysisData from '@/data/analysis.json';

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
let cache: { timestamp: number; data: any } | null = null;

const SEARXNG_URL = process.env.SEARXNG_URL || 'http://localhost:8080';
const BLOCKLIST = [
  'porn', 'xhamster', 'adult', 'xxx', 'sex', 'nsfw', 'onlyfans', 'escort', 'camgirl', 'cam',
];
const WHITELIST = [
  'bbc.com', 'bbc.co.uk', 'skysports.com', 'theguardian.com', 'premierleague.com',
  'telegraph.co.uk', 'theathletic.com', 'independent.co.uk', 'standard.co.uk'
];

function getDomain(url?: string) {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '') : '';
  } catch {
    return '';
  }
}

function isSafeResult(r: { title?: string; snippet?: string; url?: string }, playerName?: string, teamName?: string, teamShort?: string) {
  const text = `${r.title || ''} ${r.snippet || ''} ${r.url || ''}`.toLowerCase();
  if (BLOCKLIST.some(b => text.includes(b))) return false;
  const domain = getDomain(r.url);
  if (domain && !WHITELIST.some(w => domain.endsWith(w))) return false;
  const p = (playerName || '').toLowerCase();
  const t = (teamName || '').toLowerCase();
  const ts = (teamShort || '').toLowerCase();
  if (p && !text.includes(p) && t && !text.includes(t) && ts && !text.includes(ts)) return false;
  return true;
}

async function fetchFPLData(): Promise<ProcessedPlayer[]> {
  const bootstrapRes = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
    next: { revalidate: 300 },
  });
  if (!bootstrapRes.ok) throw new Error(`Bootstrap API error: ${bootstrapRes.status}`);
  const bootstrapData: FPLData = await bootstrapRes.json();

  const fixturesRes = await fetch('https://fantasy.premierleague.com/api/fixtures/', {
    next: { revalidate: 300 },
  });
  if (!fixturesRes.ok) throw new Error(`Fixtures API error: ${fixturesRes.status}`);
  const fixtures: FPLFixture[] = await fixturesRes.json();

  const currentEvent = bootstrapData.events?.find(e => e.is_current)?.id || 
                      bootstrapData.events?.find(e => e.is_next)?.id || 1;
  const nextEvent = bootstrapData.events?.find(e => e.is_next)?.id || (currentEvent + 1);

  const teamMap = new Map(bootstrapData.teams.map(t => [t.id, t]));
  const positionMap = new Map(bootstrapData.element_types.map(p => [p.id, p]));

  const getNext3Fixtures = (teamId: number) => {
    const teamFixtures = fixtures
      .filter(f => !f.finished && (f.event || 999) >= nextEvent && (f.team_h === teamId || f.team_a === teamId))
      .sort((a, b) => (a.event || 999) - (b.event || 999))
      .slice(0, 3);

    return teamFixtures.map(f => {
      const isHome = f.team_h === teamId;
      const opponentId = isHome ? f.team_a : f.team_h;
      const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;
      const opponent = teamMap.get(opponentId);

      return {
        opponent: opponent?.short_name || 'TBD',
        difficulty,
        isHome,
      };
    });
  };

  const processedPlayers: ProcessedPlayer[] = bootstrapData.elements
    .filter(p => p.minutes > 0)
    .map(player => {
      const team = teamMap.get(player.team);
      const position = positionMap.get(player.element_type);
      const price = player.now_cost / 10;
      const form = parseFloat(player.form) || 0;
      const pointsPerGame = parseFloat(player.points_per_game) || 0;
      const pointsPerMillion = price > 0 ? pointsPerGame / price : 0;
      const ownershipPct = parseFloat(player.selected_by_percent) || 0;
      const netTransfersEvent = (player.transfers_in_event || 0) - (player.transfers_out_event || 0);
      const priceChangeEvent = player.cost_change_event || 0;
      const priceChangeStart = player.cost_change_start || 0;
      const epNext = parseFloat(player.ep_next) || 0;

      const next3Fixtures = getNext3Fixtures(player.team);
      const avgNext3Difficulty = next3Fixtures.length > 0
        ? next3Fixtures.reduce((sum, f) => sum + f.difficulty, 0) / next3Fixtures.length
        : 3;

      const transferValueScore = (form * 2) + pointsPerMillion - (avgNext3Difficulty * 1.5);

      return {
        id: player.id,
        name: player.web_name,
        team: team?.name || 'Unknown',
        teamShort: team?.short_name || 'UNK',
        position: position?.singular_name || 'Unknown',
        positionShort: position?.singular_name_short || 'UNK',
        price,
        totalPoints: player.total_points,
        form,
        pointsPerGame,
        pointsPerMillion,
        minutes: player.minutes,
        ownershipPct,
        netTransfersEvent,
        priceChangeEvent,
        priceChangeStart,
        chanceNext: player.chance_of_playing_next_round,
        status: player.status,
        news: player.news,
        epNext,
        next3Fixtures,
        avgNext3Difficulty,
        transferValueScore,
      };
    });

  return processedPlayers;
}

async function searxngSearch(query: string, player: ProcessedPlayer) {
  try {
    const url = new URL('/search', SEARXNG_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('time_range', 'day');
    url.searchParams.set('language', 'en');

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`SearXNG error: ${res.status}`);
    const data = await res.json();

    const results = (data.results || [])
      .map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: r.content || r.snippet || '',
      }))
      .filter((r: { title?: string; snippet?: string; url?: string }) => isSafeResult(r, player.name, player.team, player.teamShort))
      .slice(0, 3);

    return results;
  } catch (err) {
    console.error('SearXNG fetch failed:', err);
    return [];
  }
}

function buildFallbackWhyBuy(player: ProcessedPlayer) {
  const easyCount = player.next3Fixtures.filter(f => f.difficulty <= 2).length;
  const toughCount = player.next3Fixtures.filter(f => f.difficulty >= 4).length;
  const homeCount = player.next3Fixtures.filter(f => f.isHome).length;

  const hookPool = [
    `{name} is the kind of buy you make because the role feels sticky and the next run invites immediate returns.`,
    `{name} is the one I’d move for now because his minutes and form point to a haul in the short window.`,
    `{name} is a bold but smart move right now — the setup is there for a swing in the next couple of weeks.`,
    `{name} is the momentum pick I’d back; the context around him screams short‑term upside.`,
    `{name} is the squad‑shaper this week — he’s the one who can shift rank quickly if he hits.`,
  ];

  const opener = hookPool[player.id % hookPool.length].replace('{name}', player.name);

  const fixtureNod = easyCount >= 2
    ? 'The near‑term run is kind, especially with home advantage in the mix.'
    : toughCount >= 2
      ? 'It’s not the easiest stretch, but talent can still beat the schedule.'
      : 'The schedule is mixed, which makes his role even more important than the fixtures.';

  const minutesNote = player.minutes >= 900
    ? 'He’s logging serious minutes, so you’re buying reliability as much as upside.'
    : player.minutes >= 450
      ? 'Minutes are solid but not fully nailed, so there’s a small rotation tax.'
      : 'Minutes are light, so this is a higher‑risk swing.';

  const ownershipNote = player.ownershipPct < 10
    ? 'He stays differential, which is exactly how you make ground if he pops.'
    : player.ownershipPct >= 20
      ? 'He’s already popular, so this is as much protection as it is attack.'
      : 'He’s trending into the template, which usually isn’t an accident.';

  const marketNod = player.netTransfersEvent > 0
    ? 'The market is leaning his way, but the case stands even without the hype.'
    : player.netTransfersEvent < 0
      ? 'The market is cooling a touch, which could make this the right contrarian moment.'
      : 'The market is quiet, which keeps this move purely about your conviction.';

  const availabilityNote = player.chanceNext !== null && player.chanceNext < 75
    ? `Just keep an eye on availability (${player.chanceNext}% chance of playing).`
    : player.status !== 'a'
      ? 'Just keep an eye on availability flags.'
      : '';

  const verdict = easyCount >= 2 && player.minutes >= 450
    ? 'If you’re moving now, he’s one of the cleanest short‑term buys.'
    : toughCount >= 2
      ? 'I’d only pull the trigger if his role fits your plan — the fixtures add risk.'
      : 'He’s a sensible buy if your squad needs that specific profile.';

  const sentences = [
    opener,
    fixtureNod + ' ' + minutesNote,
    ownershipNote + ' ' + marketNod,
    availabilityNote,
    verdict,
  ].filter(Boolean);

  // Return 3–4 sentences max
  const final = sentences.length > 4 ? sentences.slice(0, 4) : sentences
  return final.join(' ').replace(/\s+/g, ' ').trim();
}

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({ ...cache.data, cached: true });
    }

    const players = await fetchFPLData();
    const top5 = [...players]
      .sort((a, b) => b.transferValueScore - a.transferValueScore)
      .slice(0, 5);

    const analysisMap = new Map(
      (analysisData.analyses || []).map((a: any) => [a.playerId, a])
    );

    const analyses = await Promise.all(
      top5.map(async (player) => {
        const cached = analysisMap.get(player.id);
        if (cached?.whyBuy) {
          return {
            playerId: player.id,
            playerName: player.name,
            teamShort: player.teamShort,
            price: player.price,
            pickScore: Number(player.transferValueScore.toFixed(1)),
            whyBuy: cached.whyBuy,
            news: (cached.news || []).filter((r: any) => isSafeResult(r, player.name, player.team, player.teamShort)),
            source: 'manual',
          };
        }

        const news = await searxngSearch(`${player.name} EPL injury form news`, player);
        return {
          playerId: player.id,
          playerName: player.name,
          teamShort: player.teamShort,
          price: player.price,
          pickScore: Number(player.transferValueScore.toFixed(1)),
          whyBuy: buildFallbackWhyBuy(player),
          news,
          source: 'fallback',
        };
      })
    );

    const payload = {
      generatedAt: new Date().toISOString(),
      analyses,
    };

    cache = { timestamp: Date.now(), data: payload };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Analyze picks error:', error);
    return NextResponse.json({ error: 'Failed to analyze picks' }, { status: 500 });
  }
}
