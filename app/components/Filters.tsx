'use client';

interface FiltersProps {
  positionFilter: string;
  setPositionFilter: (pos: string) => void;
  maxPrice: number;
  setMaxPrice: (price: number) => void;
}

const positions = [
  { value: 'ALL', label: 'All Positions' },
  { value: 'GKP', label: 'Goalkeeper' },
  { value: 'DEF', label: 'Defender' },
  { value: 'MID', label: 'Midfielder' },
  { value: 'FWD', label: 'Forward' },
];

export default function Filters({ positionFilter, setPositionFilter, maxPrice, setMaxPrice }: FiltersProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm text-gray-400 mb-2">Position</label>
          <div className="flex flex-wrap gap-2">
            {positions.map(pos => (
              <button
                key={pos.value}
                onClick={() => setPositionFilter(pos.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  positionFilter === pos.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {pos.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="sm:w-64">
          <label className="block text-sm text-gray-400 mb-2">
            Max Price: <span className="text-white font-bold">£{maxPrice.toFixed(1)}m</span>
          </label>
          <input
            type="range"
            min="4.0"
            max="15.0"
            step="0.5"
            value={maxPrice}
            onChange={(e) => setMaxPrice(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>£4.0m</span>
            <span>£15.0m</span>
          </div>
        </div>
      </div>
    </div>
  );
}
