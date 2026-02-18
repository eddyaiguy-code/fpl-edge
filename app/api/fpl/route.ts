import { NextResponse } from 'next/server';
import { FPLData, FPLFixture, ProcessedPlayer } from '@/types/fpl';

export async function GET() {
  try {
    // Fetch bootstrap-static data
    const bootstrapRes = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });
    
    if (!bootstrapRes.ok) {
      throw new Error(`Bootstrap API error: ${bootstrapRes.status}`);
    }
    
    const bootstrapData: FPLData = await bootstrapRes.json();

    // Fetch fixtures data
    const fixturesRes = await fetch('https://fantasy.premierleague.com/api/fixtures/', {
      next: { revalidate: 300 },
    });
    
    if (!fixturesRes.ok) {
      throw new Error(`Fixtures API error: ${fixturesRes.status}`);
    }
    
    const fixtures: FPLFixture[] = await fixturesRes.json();

    // Get current and next gameweek
    const currentEvent = bootstrapData.events?.find(e => e.is_current)?.id || 
                        bootstrapData.events?.find(e => e.is_next)?.id || 1;
    const nextEvent = bootstrapData.events?.find(e => e.is_next)?.id || (currentEvent + 1);

    // Create lookup maps
    const teamMap = new Map(bootstrapData.teams.map(t => [t.id, t]));
    const positionMap = new Map(bootstrapData.element_types.map(p => [p.id, p]));

    // Get next 3 fixtures for each team (from next gameweek)
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

    // Process players
    const processedPlayers: ProcessedPlayer[] = bootstrapData.elements
      .filter(p => p.minutes > 0) // Only players with game time
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

        // Transfer Value Score = (form × 2) + (points per million) - (avg difficulty × 1.5)
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

    return NextResponse.json({
      players: processedPlayers,
      currentGameweek: currentEvent,
      nextGameweek: nextEvent,
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('FPL API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch FPL data' },
      { status: 500 }
    );
  }
}
