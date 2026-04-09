/** Vercel/dashboard paste sometimes includes wrapping quotes — those break auth. */
export function normalizeBlobEnvToken(raw: string): string {
  let t = raw.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

export function getBlobReadWriteToken(): string | null {
  const a = process.env.BLOB_READ_WRITE_TOKEN;
  const b = process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
  const picked = (a ?? b ?? "").trim();
  if (!picked) return null;
  return normalizeBlobEnvToken(picked);
}
