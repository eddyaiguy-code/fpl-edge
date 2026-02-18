export interface FPLTeam {
  id: number;
  name: string;
  short_name: string;
}

export interface FPLPlayer {
  id: number;
  first_name: string;
  second_name: string;
  web_name: string;
  team: number;
  element_type: number;
  now_cost: number;
  total_points: number;
  form: string;
  points_per_game: string;
  minutes: number;
  selected_by_percent: string;
  transfers_in_event: number;
  transfers_out_event: number;
  transfers_in: number;
  transfers_out: number;
  status: string;
  news: string;
  chance_of_playing_next_round: number | null;
  cost_change_event: number;
  cost_change_start: number;
  ep_next: string;
}

export interface FPLFixture {
  id: number;
  event: number | null;
  finished: boolean;
  finished_provisional: boolean;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
  event_name?: string;
}

export interface FPLData {
  elements: FPLPlayer[];
  teams: FPLTeam[];
  element_types: {
    id: number;
    singular_name: string;
    singular_name_short: string;
  }[];
  events?: {
    id: number;
    is_current: boolean;
    is_next: boolean;
  }[];
}

export interface ProcessedPlayer {
  id: number;
  name: string;
  team: string;
  teamShort: string;
  position: string;
  positionShort: string;
  price: number;
  totalPoints: number;
  form: number;
  pointsPerGame: number;
  pointsPerMillion: number;
  ownershipPct: number;
  netTransfersEvent: number;
  priceChangeEvent: number;
  priceChangeStart: number;
  chanceNext: number | null;
  status: string;
  news: string;
  epNext: number;
  next3Fixtures: {
    opponent: string;
    difficulty: number;
    isHome: boolean;
  }[];
  avgNext3Difficulty: number;
  transferValueScore: number;
}
