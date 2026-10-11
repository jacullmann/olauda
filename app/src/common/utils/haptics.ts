const DEFAULT_DURATION_MS = 10;

/** A short haptic tick, or nothing where the browser lacks the Vibration API. */
export function haptic(duration = DEFAULT_DURATION_MS) {
  try {
    navigator.vibrate?.(duration);
  } catch {
    // Feedback is a nicety; browsers are free to refuse it.
  }
}
