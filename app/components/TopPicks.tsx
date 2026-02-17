'use client';

import { ProcessedPlayer } from '@/types/fpl';

interface TopPicksProps {
  players: ProcessedPlayer[];
}

export default function TopPicks({ players }: TopPicksProps) {
  const top5 = [...players]
    .sort((a, b) => b.transferValueScore - a.transferValueScore)
    .slice(0, 5);

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return 'text-green-400';
    if (difficulty === 3) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-purple-400">Top 5 Transfer Picks</span>
        <span className="text-sm font-normal text-gray-400">This Gameweek</span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {top5.map((player, index) => (
          <div
            key={player.id}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-purple-500 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold text-purple-400">#{index + 1}</span>
              <span className="text-xs px-2 py-1 bg-purple-900/50 text-purple-300 rounded">
                {player.positionShort}
              </span>
            </div>
            <h3 className="font-bold text-white truncate">{player.name}</h3>
            <p className="text-sm text-gray-400 mb-2">{player.team}</p>
            
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Value Score</span>
                <span className="font-bold text-green-400">
                  {player.transferValueScore.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Price</span>
                <span className="text-white">£{player.price.toFixed(1)}m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Form</span>
                <span className="text-white">{player.form}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Next 3 FDR</span>
                <span className={getDifficultyColor(player.avgNext3Difficulty)}>
                  {player.avgNext3Difficulty.toFixed(1)}
                </span>
              </div>
            </div>

            <div className="mt-3 flex gap-1 text-xs">
              {player.next3Fixtures.map((fixture, i) => (
                <span
                  key={i}
                  className={`px-1.5 py-0.5 rounded ${
                    fixture.difficulty <= 2 ? 'bg-green-900/50 text-green-400' :
                    fixture.difficulty === 3 ? 'bg-yellow-900/50 text-yellow-400' :
                    'bg-red-900/50 text-red-400'
                  }`}
                >
                  {fixture.isHome ? '' : '@'}{fixture.opponent}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
