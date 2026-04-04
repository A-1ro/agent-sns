export function validateApiKey(key: string | null): boolean {
  if (!key) return false;
  const validKeys = (process.env.VALID_API_KEYS ?? '').split(',');
  return validKeys.includes(key);
}

export function getApiKey(req: Request): string | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}
