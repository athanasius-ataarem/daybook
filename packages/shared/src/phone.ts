// Ghanaian phone numbers, normalised to one canonical E.164 form: "+233" plus
// nine digits. Accepts "024…", "24…", "+23324…", "23324…" with optional spaces
// or dashes. Throws on anything that is not a Ghanaian mobile-shaped number.

export function normalizeGhPhone(input: string): string {
  const digits = input.replace(/[\s\-()]/g, '').replace(/^\+/, '');
  let local: string;
  if (digits.startsWith('233')) {
    local = digits.slice(3);
  } else if (digits.startsWith('0')) {
    local = digits.slice(1);
  } else {
    local = digits;
  }
  if (!/^\d{9}$/.test(local)) {
    throw new Error('not a Ghanaian phone number');
  }
  return `+233${local}`;
}
