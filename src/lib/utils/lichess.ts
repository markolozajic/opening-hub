const LICHESS_RE = /^(?:https?:\/\/)?(?:www\.)?lichess\.org\/(?:game\/)?([a-zA-Z0-9]{8,})\b/;

export function parseLichessUrl(url: string): string | null {
  const m = url.match(LICHESS_RE);
  return m ? m[1] : null;
}

export async function fetchLichessPgn(gameId: string): Promise<string> {
  const res = await fetch(`https://lichess.org/game/export/${gameId}`);
  if (!res.ok) throw new Error(`Lichess returned ${res.status}`);
  return res.text();
}
