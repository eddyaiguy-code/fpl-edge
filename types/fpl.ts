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
  next3Fixtures: {
    opponent: string;
    difficulty: number;
    isHome: boolean;
  }[];
  avgNext3Difficulty: number;
  transferValueScore: number;
}
