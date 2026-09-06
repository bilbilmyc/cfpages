export function readLocal<T>(key: string, fallback: T, validate: (v: unknown) => v is T): T {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || 'null');
    return validate(value) ? value : fallback;
  } catch {
    return fallback;
  }
}
export function saveLocal(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
