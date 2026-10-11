import type { CSSProperties } from 'vue';

export interface FixedTableLayout {
  table: CSSProperties;
  columns: CSSProperties[];
}

/**
 * A table whose columns keep their widths while its rows come and go, as in a
 * virtual list, where automatic layout would size them to whatever is shown.
 *
 * The table fills its container but never gets narrower than its columns, so
 * it scrolls sideways instead. That minimum is set explicitly: the global
 * `min-width: max-content` resolves to a near-infinite width in WebKit for a
 * fixed-layout table with a percentage width, which would leave only the
 * first column on screen.
 */
export function fixedTableLayout(
  columnWidthsRem: readonly number[],
): FixedTableLayout {
  const total = columnWidthsRem.reduce((sum, width) => sum + width, 0);
  return {
    table: { tableLayout: 'fixed', width: '100%', minWidth: `${total}rem` },
    columns: columnWidthsRem.map((width) => ({ width: `${width}rem` })),
  };
}
