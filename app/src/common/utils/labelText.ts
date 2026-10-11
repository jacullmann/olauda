/**
 * Text of the `<label for="id">` pointing at a control, without decorations
 * like BaseLabel's aria-hidden required asterisk.
 */
export function labelTextFor(id: unknown): string | undefined {
  if (typeof id !== 'string') return undefined;

  const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
  if (!label) return undefined;

  const clone = label.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove());
  return clone.textContent?.trim() || undefined;
}
