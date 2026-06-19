export type Repertoire = 'white' | 'black';

export type ComfortLevel = 'easy' | 'comfortable' | 'moderate' | 'uncomfortable' | 'struggling';
export type MoveMarker = '?' | '!' | '!?' | '?!' | '??' | '!!' | 'N';
export type MoveLabel = 'main' | 'alternative' | 'avoid';
export type SortMode = 'comfort' | 'manual';

export interface MoveEdge {
  toFen: string;
  comment?: string;
  autoDetected?: boolean;
  label?: MoveLabel;
  marker?: MoveMarker;
}

export interface Link {
  id: string;
  url: string;
  label: string;
  type: 'youtube' | 'other';
}

export interface PgnAttachment {
  id: string;
  pgn: string;
  label: string;
}

export interface Position {
  repertoire: Repertoire;
  fen: string;
  name?: string;
  autoNamed?: boolean;
  moveOrder?: string[];
  dismissedTranspositions?: string[];
  comment?: string;
  comfortLevel?: ComfortLevel;
  forcedDraw?: boolean;
  practicalDraw?: boolean;
  moves: Record<string, MoveEdge>;
  links: Link[];
  pgnAttachments: PgnAttachment[];
  createdAt: number;
  updatedAt: number;
}

export interface PreparationRecord {
  repertoire: Repertoire;
  player: string;
  taggedFens: string[];
  updatedAt?: string;
}

export interface VerboseMove {
  from: string;
  to: string;
  san: string;
  color: 'w' | 'b';
}

export interface MovePathStep {
  fen: string;
  toFen: string;
  san: string;
  marker?: MoveMarker;
}
