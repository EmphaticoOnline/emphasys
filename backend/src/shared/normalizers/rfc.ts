export function normalizeRFC(rfc: string | null | undefined): string | null {
  if (rfc == null) return null;

  const trimmed = rfc.trim();
  if (!trimmed) return null;

  return trimmed.toUpperCase();
}
