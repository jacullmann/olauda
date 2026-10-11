export interface MenuAnchor {
  x: number;
  y: number;
}

/**
 * Menus open at the pointer. A click from the keyboard has no pointer
 * position, so the menu opens below the button that was pressed instead.
 */
export function menuAnchor(event: MouseEvent): MenuAnchor {
  const button =
    event.type === 'click' && event.detail === 0
      ? (event.target as Element | null)?.closest('button')
      : null;
  if (!button) return { x: event.clientX, y: event.clientY };
  const { left, bottom } = button.getBoundingClientRect();
  return { x: left, y: bottom };
}
