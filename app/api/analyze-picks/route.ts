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
  const ownershipLabel = player.ownershipPct >= 20
    ? 'highly owned'
    : player.ownershipPct >= 10
      ? 'popular'
      : player.ownershipPct >= 5
        ? 'mid‑owned'
        : 'differential';

  const transferText = player.netTransfersEvent > 0
    ? `Rising in transfers (${player.netTransfersEvent.toLocaleString()} net in)`
    : player.netTransfersEvent < 0
      ? `Falling in transfers (${Math.abs(player.netTransfersEvent).toLocaleString()} net out)`
      : 'Flat transfer momentum this week';

  const priceText = player.priceChangeEvent > 0
    ? `price just rose £${(player.priceChangeEvent / 10).toFixed(1)}m`
    : player.priceChangeEvent < 0
      ? `price just dropped £${(Math.abs(player.priceChangeEvent) / 10).toFixed(1)}m`
      : 'price stable';

  const easyCount = player.next3Fixtures.filter(f => f.difficulty <= 2).length;
  const toughCount = player.next3Fixtures.filter(f => f.difficulty >= 4).length;
  const homeCount = player.next3Fixtures.filter(f => f.isHome).length;
  const fixtureRun = easyCount >= 2
    ? 'a strong short‑term run'
    : toughCount >= 2
      ? 'a tough short‑term run'
      : 'a mixed short‑term run';

  const minutesNote = player.minutes >= 900
    ? 'Minutes suggest he’s first‑choice.'
    : player.minutes >= 450
      ? 'Minutes are decent but not nailed.'
      : 'Minutes are low — rotation risk.';

  const availabilityNote = player.chanceNext !== null && player.chanceNext < 75
    ? `Availability risk (${player.chanceNext}% chance of playing).`
    : player.status !== 'a'
      ? 'Availability risk flagged.'
      : '';

  const valueNote = player.pointsPerMillion >= 0.7
    ? `Strong value at £${player.price.toFixed(1)}m (${player.pointsPerMillion.toFixed(2)} PPM).`
    : `Premium priced at £${player.price.toFixed(1)}m — needs returns to justify it.`;

  const ceilingNote = player.epNext >= 5
    ? 'Expected points outlook is solid for a haul.'
    : 'Ceiling leans on current form rather than fixtures.';

  const verdict = player.ownershipPct < 10 && easyCount >= 2
    ? 'Verdict: buy as a differential with upside over the next 2–3 GWs.'
    : player.ownershipPct >= 20 && toughCount >= 2
      ? 'Verdict: consider a short‑term hold rather than a fresh buy.'
      : 'Verdict: viable buy if you need his role/price point.';

  return `${transferText}; ${ownershipLabel} at ${player.ownershipPct.toFixed(1)}% with ${priceText}. ` +
    `Fixtures show ${fixtureRun} (${homeCount} home in the next 3). ${minutesNote} ${availabilityNote} ` +
    `${valueNote} ${ceilingNote} ${verdict}`.replace(/\s+/g, ' ').trim();
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
