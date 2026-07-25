// The weak-PIN reject list, enumerated in DECISIONS.md: the ten repeats,
// ten common patterns, and birth years 1940-2035.

const WEAK_PINS = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '4321', '1212', '1313', '1010', '1122', '2580', '2000', '2001', '6969',
]);

export function isWeakPin(pin: string): boolean {
  if (WEAK_PINS.has(pin)) return true;
  const asYear = Number.parseInt(pin, 10);
  return asYear >= 1940 && asYear <= 2035;
}
