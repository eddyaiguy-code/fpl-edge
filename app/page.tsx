'use client';

import { useState, useEffect } from 'react';
import { ProcessedPlayer } from '@/types/fpl';
import TopPicks from './components/TopPicks';
import Filters from './components/Filters';
import PlayerTable from './components/PlayerTable';

interface FPLData {
  players: ProcessedPlayer[];
  currentGameweek: number;
  nextGameweek: number;
  lastUpdated: string;
}

export default function Home() {
  const [data, setData] = useState<FPLData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [maxPrice, setMaxPrice] = useState(15.0);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/fpl');
        if (!res.ok) throw new Error('Failed to fetch data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading FPL data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-2">Error loading data</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <main className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-green-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">FPL</span>
            </div>
            <h1 className="text-3xl font-bold text-white">FPL Edge</h1>
          </div>
          <p className="text-gray-400">
            Fantasy Premier League Transfer Optimizer • GW{data.currentGameweek} (next: GW{data.nextGameweek})
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Last updated: {new Date(data.lastUpdated).toLocaleString()}
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-green-900/50 border border-green-400"></span>
            <span className="text-gray-400">Easy (1-2)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-yellow-900/50 border border-yellow-400"></span>
            <span className="text-gray-400">Medium (3)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-red-900/50 border border-red-400"></span>
            <span className="text-gray-400">Hard (4-5)</span>
          </div>
          <div className="ml-auto text-gray-500">
            TVS = Transfer Value Score
          </div>
        </div>

        {/* Top 5 Picks */}
        <TopPicks players={data.players} currentGameweek={data.nextGameweek} />

        {/* Filters */}
        <Filters 
          positionFilter={positionFilter}
          setPositionFilter={setPositionFilter}
          maxPrice={maxPrice}
          setMaxPrice={setMaxPrice}
        />

        {/* Player Table */}
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
          <PlayerTable 
            players={data.players}
            positionFilter={positionFilter}
            maxPrice={maxPrice}
          />
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-xs text-gray-600">
          <p>Data from Fantasy Premier League API • Not affiliated with FPL</p>
        </footer>
      </div>
    </main>
  );
}
