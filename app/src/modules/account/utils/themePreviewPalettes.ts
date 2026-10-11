export type ThemePreviewScene = 'light' | 'dark';

export interface ThemePreviewPalette {
  canvas: string;
  surface: string;
  highlight: string;
  border: string;
  text: string;
  muted: string;
  outline: string;
}

// Fixed palette tokens rather than the semantic ones, which follow the active theme.
export const themePreviewPalettes: Record<
  ThemePreviewScene,
  ThemePreviewPalette
> = {
  light: {
    canvas: 'fill-white',
    surface: 'fill-white',
    highlight: 'fill-vapor',
    border: 'stroke-smoke',
    text: 'fill-graphite',
    muted: 'fill-ash',
    outline: 'stroke-ghost',
  },
  dark: {
    canvas: 'fill-onyx',
    surface: 'fill-charcoal',
    highlight: 'fill-mist',
    border: 'stroke-mist',
    text: 'fill-ash',
    muted: 'fill-graphite',
    outline: 'stroke-steel',
  },
};
