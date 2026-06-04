import Dexie, { type Table } from 'dexie';
import type { Position } from '../types';

export class OpeningHubDB extends Dexie {
  positions: Table<Position, [string, string]>;

  constructor() {
    super('OpeningHub');
    this.version(1).stores({});
    this.version(2).stores({ positions: null });
    this.version(3).stores({
      positions: '[repertoire+fen], repertoire, fen, name, comfortLevel, updatedAt',
    });
    this.positions = this.table('positions');
  }
}

export const db = new OpeningHubDB();
