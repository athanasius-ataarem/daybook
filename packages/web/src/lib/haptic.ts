/** One haptic in the whole app: a 10ms tick on a successful save. */
export function saveTick(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(10);
  }
}
