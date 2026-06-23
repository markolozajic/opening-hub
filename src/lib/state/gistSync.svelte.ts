import { db } from '../db/schema';
import { positionCache } from '../db/positionStore.svelte';
import { toPlain } from '../utils/helpers';
import { cacheKey } from '../utils/fen';
import type { Position, PreparationRecord, Repertoire } from '../types';
import { loadFromDb } from './preparation.svelte';

const GIST_TOKEN_KEY = 'openinghub_gist_token';
const GIST_ID_KEY = 'openinghub_gist_id';

export const syncState = $state({
  hasToken: false,
  hasGist: false,
  tokenPreview: '',
  saving: false,
  loading: false,
  lastSave: null as string | null,
  error: null as string | null,
});

function readCreds(): void {
  const token = localStorage.getItem(GIST_TOKEN_KEY);
  const gistId = localStorage.getItem(GIST_ID_KEY);
  syncState.hasToken = !!token;
  syncState.hasGist = !!(token && gistId);
  syncState.tokenPreview = token ? `${token.slice(0, 4)}…${token.slice(-4)}` : '';
}

export function getGistCredentials(): { token: string; gistId?: string } | null {
  const token = localStorage.getItem(GIST_TOKEN_KEY);
  const gistId = localStorage.getItem(GIST_ID_KEY);
  if (!token) return null;
  return { token, gistId: gistId ?? '' };
}

export function setGistCredentials(token: string, gistId: string): void {
  localStorage.setItem(GIST_TOKEN_KEY, token);
  localStorage.setItem(GIST_ID_KEY, gistId);
  readCreds();
  if (gistId) {
    saveToGist();
  }
}

export function clearGistCredentials(): void {
  localStorage.removeItem(GIST_TOKEN_KEY);
  localStorage.removeItem(GIST_ID_KEY);
  readCreds();
}

function credentials(): { token: string; gistId: string } | null {
  const creds = getGistCredentials();
  if (!creds) {
    syncState.error = 'No GitHub credentials configured.';
    return null;
  }
  if (!creds.gistId) {
    syncState.error = 'No Gist linked. Create or link a Gist in Settings.';
    return null;
  }
  return { token: creds.token, gistId: creds.gistId };
}

export async function createGist(json?: string): Promise<string> {
  const creds = getGistCredentials();
  if (!creds) throw new Error('No token configured.');

  const content = json ?? await dumpLocalData();

  const res = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      Authorization: `token ${creds.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      description: 'Opening Hub repertoire backup',
      public: false,
      files: { 'repertoire.json': { content: content } },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.id as string;
}

async function pullFromGist(): Promise<string | null> {
  const creds = credentials();
  if (!creds) return null;

  const res = await fetch(`https://api.github.com/gists/${creds.gistId}`, {
    headers: {
      Authorization: `token ${creds.token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const file = data.files?.['repertoire.json'];
  if (!file || !file.content) return null;
  return file.content as string;
}

async function pushToGist(json: string): Promise<void> {
  const creds = credentials();
  if (!creds) return;

  const res = await fetch(`https://api.github.com/gists/${creds.gistId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `token ${creds.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      files: { 'repertoire.json': { content: json } },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }
}

async function dumpLocalData(): Promise<string> {
  const positions = await db.positions.toArray();
  const preparation = await db.preparation.toArray();
  return JSON.stringify({ positions, preparation });
}

async function mergeCloudIntoLocal(cloudJson: string): Promise<void> {
  const cloud = JSON.parse(cloudJson) as { positions: Position[]; preparation?: PreparationRecord[] };
  const localPositions = await db.positions.toArray();

  const cloudMap = new Map<string, Position>();
  for (const p of cloud.positions) {
    cloudMap.set(cacheKey(p.repertoire, p.fen), p);
  }

  const localMap = new Map<string, Position>();
  for (const p of localPositions) {
    localMap.set(cacheKey(p.repertoire, p.fen), p);
  }

  const allKeys = new Set([...cloudMap.keys(), ...localMap.keys()]);
  const mergedPositions: Position[] = [];

  for (const key of allKeys) {
    const cloudP = cloudMap.get(key);
    const localP = localMap.get(key);
    if (!cloudP) {
      mergedPositions.push(localP!);
    } else if (!localP) {
      mergedPositions.push(cloudP);
      positionCache[key] = cloudP;
    } else if (cloudP.updatedAt > localP.updatedAt) {
      mergedPositions.push(cloudP);
      positionCache[key] = cloudP;
    } else {
      mergedPositions.push(localP);
    }
  }

  await db.transaction('rw', db.positions, async () => {
    await db.positions.clear();
    for (const p of mergedPositions) {
      await db.positions.put(toPlain(p));
    }
  });

  const cloudPrep = cloud.preparation ?? [];
  const localPrep = await db.preparation.toArray();

  const cloudPrepMap = new Map<string, PreparationRecord>();
  for (const pr of cloudPrep) {
    if (!pr.player) continue;
    cloudPrepMap.set(`${pr.repertoire}|${pr.player}`, pr);
  }

  const localPrepMap = new Map<string, PreparationRecord>();
  for (const pr of localPrep) {
    if (!pr.player) continue;
    localPrepMap.set(`${pr.repertoire}|${pr.player}`, pr);
  }

  const allPrepKeys = new Set([...cloudPrepMap.keys(), ...localPrepMap.keys()]);
  const mergedPrep: PreparationRecord[] = [];

  for (const key of allPrepKeys) {
    const cloudPr = cloudPrepMap.get(key);
    const localPr = localPrepMap.get(key);
    if (!cloudPr) {
      mergedPrep.push(localPr!);
    } else if (!localPr) {
      mergedPrep.push(cloudPr);
    } else {
      const merged = new Set([...cloudPr.taggedFens, ...localPr.taggedFens]);
      mergedPrep.push({ ...cloudPr, taggedFens: Array.from(merged) });
    }
  }

  await db.transaction('rw', db.preparation, async () => {
    await db.preparation.clear();
    for (const pr of mergedPrep) {
      await db.preparation.put(pr);
    }
  });
}

async function loadFromGist(): Promise<void> {
  const creds = credentials();
  if (!creds) return;

  syncState.loading = true;
  syncState.error = null;

  try {
    const cloudJson = await pullFromGist();
    if (cloudJson) {
      await mergeCloudIntoLocal(cloudJson);
    }
  } catch (e) {
    syncState.error = e instanceof Error ? e.message : 'Load failed';
  } finally {
    syncState.loading = false;
  }
}

export async function saveToGist(): Promise<void> {
  const creds = credentials();
  if (!creds) return;

  syncState.saving = true;
  syncState.error = null;

  try {
    const json = await dumpLocalData();
    await pushToGist(json);
    syncState.lastSave = new Date().toLocaleString();
  } catch (e) {
    syncState.error = e instanceof Error ? e.message : 'Save failed';
  } finally {
    syncState.saving = false;
  }
}

export async function initSync(): Promise<void> {
  readCreds();
  if (!syncState.hasGist) return;
  await loadFromGist();
  await loadFromDb('white');
  await loadFromDb('black');
}
