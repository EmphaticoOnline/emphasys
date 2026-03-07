export function normalizePhone(phone: string | null | undefined): string | null {
  if (phone == null) return null;

  let digits = phone.replace(/\D+/g, '');

  if (!digits) return null;

  // Remove mobile prefixes 044 or 045 first
  if ((digits.startsWith('044') || digits.startsWith('045')) && digits.length > 10) {
    digits = digits.slice(3);
  }

  // Remove country code 52 when present and there are extra digits beyond 10
  if (digits.startsWith('52') && digits.length > 10) {
    digits = digits.slice(2);
  }

  if (digits.length > 10) {
    digits = digits.slice(-10);
  }

  return digits || null;
}