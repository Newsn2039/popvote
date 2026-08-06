export interface Teacher {
  id: string;
  name: string;
  image: string;
}

export type GameStatus = 'idle' | 'waiting' | 'voting' | 'closed' | 'finalized';

export interface GameState {
  status: GameStatus;
  teachers: Teacher[];
  votingEndsAt: number | null;
  durationMinutes: number;
  connectedClients: number;
}

export interface RacePosition {
  id: string;
  progress: number;
}

export interface RaceUpdate {
  positions: RacePosition[];
}

export interface VoteResult {
  teacher: Teacher;
  votes: number;
}

export interface FinalResults {
  rankings: VoteResult[];
}
