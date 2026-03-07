export function normalizeEmail(email: string | null | undefined): string | null {
  if (email == null) return null;

  const trimmed = email.trim();
  if (!trimmed) return null;

  return trimmed.toLowerCase();
}
