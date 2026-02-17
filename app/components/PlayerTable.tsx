'use client';

import { useState, useMemo } from 'react';
import { ProcessedPlayer } from '@/types/fpl';

type SortKey = 'transferValueScore' | 'form' | 'totalPoints' | 'price' | 'avgNext3Difficulty' | 'pointsPerMillion';
type SortOrder = 'asc' | 'desc';

interface PlayerTableProps {
  players: ProcessedPlayer[];
  positionFilter: string;
  maxPrice: number;
}

export default function PlayerTable({ players, positionFilter, maxPrice }: PlayerTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('transferValueScore');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const filteredAndSortedPlayers = useMemo(() => {
    let filtered = players.filter(p => {
      if (positionFilter !== 'ALL' && p.positionShort !== positionFilter) return false;
      if (p.price > maxPrice) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [players, positionFilter, maxPrice, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) return '↕';
    return sortOrder === 'desc' ? '↓' : '↑';
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return 'text-green-400';
    if (difficulty === 3) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getValueScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 5) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-3 px-2 text-gray-400 font-medium">Player</th>
            <th className="text-left py-3 px-2 text-gray-400 font-medium">Team</th>
            <th className="text-left py-3 px-2 text-gray-400 font-medium">Pos</th>
            <th 
              className="text-right py-3 px-2 text-gray-400 font-medium cursor-pointer hover:text-white"
              onClick={() => handleSort('price')}
            >
              Price {getSortIcon('price')}
            </th>
            <th 
              className="text-right py-3 px-2 text-gray-400 font-medium cursor-pointer hover:text-white"
              onClick={() => handleSort('totalPoints')}
            >
              Pts {getSortIcon('totalPoints')}
            </th>
            <th 
              className="text-right py-3 px-2 text-gray-400 font-medium cursor-pointer hover:text-white"
              onClick={() => handleSort('form')}
            >
              Form {getSortIcon('form')}
            </th>
            <th 
              className="text-right py-3 px-2 text-gray-400 font-medium cursor-pointer hover:text-white"
              onClick={() => handleSort('pointsPerMillion')}
            >
              Pts/£ {getSortIcon('pointsPerMillion')}
            </th>
            <th 
              className="text-right py-3 px-2 text-gray-400 font-medium cursor-pointer hover:text-white"
              onClick={() => handleSort('avgNext3Difficulty')}
            >
              FDR {getSortIcon('avgNext3Difficulty')}
            </th>
            <th 
              className="text-right py-3 px-2 text-purple-400 font-bold cursor-pointer hover:text-purple-300"
              onClick={() => handleSort('transferValueScore')}
            >
              TVS {getSortIcon('transferValueScore')}
            </th>
            <th className="text-left py-3 px-2 text-gray-400 font-medium">Next 3</th>
          </tr>
        </thead>
        <tbody>
          {filteredAndSortedPlayers.map(player => (
            <tr key={player.id} className="border-b border-gray-800 hover:bg-gray-800/50">
              <td className="py-3 px-2 font-medium text-white">{player.name}</td>
              <td className="py-3 px-2 text-gray-400">{player.teamShort}</td>
              <td className="py-3 px-2">
                <span className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded">
                  {player.positionShort}
                </span>
              </td>
              <td className="py-3 px-2 text-right text-white">£{player.price.toFixed(1)}m</td>
              <td className="py-3 px-2 text-right text-white">{player.totalPoints}</td>
              <td className="py-3 px-2 text-right text-white">{player.form}</td>
              <td className="py-3 px-2 text-right text-white">{player.pointsPerMillion.toFixed(1)}</td>
              <td className={`py-3 px-2 text-right font-medium ${getDifficultyColor(player.avgNext3Difficulty)}`}>
                {player.avgNext3Difficulty.toFixed(1)}
              </td>
              <td className={`py-3 px-2 text-right font-bold ${getValueScoreColor(player.transferValueScore)}`}>
                {player.transferValueScore.toFixed(1)}
              </td>
              <td className="py-3 px-2">
                <div className="flex gap-1">
                  {player.next3Fixtures.map((fixture, i) => (
                    <span
                      key={i}
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        fixture.difficulty <= 2 ? 'bg-green-900/50 text-green-400' :
                        fixture.difficulty === 3 ? 'bg-yellow-900/50 text-yellow-400' :
                        'bg-red-900/50 text-red-400'
                      }`}
                    >
                      {fixture.isHome ? '' : '@'}{fixture.opponent}
                    </span>
                  ))}
                  {player.next3Fixtures.length === 0 && (
                    <span className="text-xs text-gray-600">-</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {filteredAndSortedPlayers.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No players match your filters
        </div>
      )}
    </div>
  );
}
