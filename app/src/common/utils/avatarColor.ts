const FALLBACK_COLOR = '#777';

const AVATAR_COLORS: readonly string[] = [
  '#AA47BD',
  '#7B1FA2',
  '#77919D',
  '#455A65',
  '#EC417A',
  '#C1175C',
  '#0388D2',
  '#0098A7',
  '#EF6C00',
  '#F6511E',
];

// FNV-1a: cheap, and a single changed character scrambles the whole hash.
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function getAvatarData(name: string) {
  if (!name) return { letter: '?', background: FALLBACK_COLOR };

  const color =
    AVATAR_COLORS[hashString(name.toLowerCase()) % AVATAR_COLORS.length] ??
    FALLBACK_COLOR;

  return {
    letter: name.charAt(0).toUpperCase(),
    background: color,
  };
}
