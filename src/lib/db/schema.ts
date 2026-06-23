import Dexie, { type Table } from 'dexie';
import type { Position, PreparationRecord } from '../types';

export class OpeningHubDB extends Dexie {
  positions: Table<Position, [string, string]>;
  preparation: Table<PreparationRecord, [string, string]>;

  constructor() {
    super('OpeningHub');
    this.version(1).stores({});
    this.version(2).stores({ positions: null });
    this.version(3).stores({
      positions: '[repertoire+fen], repertoire, fen, name, comfortLevel, updatedAt',
    });
    this.version(4).stores({
      positions: '[repertoire+fen], repertoire, fen, name, comfortLevel, updatedAt',
      preparation: '[repertoire+opponent]',
    });
    this.version(5).stores({
      positions: '[repertoire+fen], repertoire, fen, name, comfortLevel, updatedAt',
      preparation: '[repertoire+opponent]',
    });
    this.positions = this.table('positions');
    this.preparation = this.table('preparation');
  }
}

export const db = new OpeningHubDB();
