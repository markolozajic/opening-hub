export function toPlain<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function clearPrefix(cache: Record<string, unknown>, prefix?: string): void {
  if (prefix) {
    for (const key of Object.keys(cache)) {
      if (key.startsWith(`${prefix}|`)) delete cache[key];
    }
  } else {
    for (const key of Object.keys(cache)) delete cache[key];
  }
}
