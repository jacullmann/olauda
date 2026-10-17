import { ref, watch } from 'vue';

export const THEME_MODES = ['system', 'light', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const isThemeMode = (value: string): value is ThemeMode =>
  (THEME_MODES as readonly string[]).includes(value);

// public/theme-init.js reads this key before the bundle loads; keep them in sync.
const LOCAL_STORAGE_KEY = 'theme-preference2gl';

const selectedThemeMode = ref<ThemeMode>('system');
const appliedThemeClass = ref<'light' | 'dark'>('dark');

function prefersDarkScheme(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyThemeClass(mode: 'light' | 'dark') {
  const htmlElement = document.documentElement;
  if (mode === 'dark') {
    htmlElement.classList.add('dark');
  } else {
    htmlElement.classList.remove('dark');
  }
  appliedThemeClass.value = mode;
}

function calculateAppliedMode(selectedMode: ThemeMode): 'light' | 'dark' {
  if (selectedMode === 'system') {
    return prefersDarkScheme() ? 'dark' : 'light';
  }
  return selectedMode;
}

function initializeTheme() {
  const storedPreference = localStorage.getItem(
    LOCAL_STORAGE_KEY,
  ) as ThemeMode | null;

  if (storedPreference && isThemeMode(storedPreference)) {
    selectedThemeMode.value = storedPreference;
  } else {
    selectedThemeMode.value = 'system';
    localStorage.setItem(LOCAL_STORAGE_KEY, 'system');
  }

  applyTheme(selectedThemeMode.value);
}

function applyTheme(newMode: ThemeMode) {
  selectedThemeMode.value = newMode;
  localStorage.setItem(LOCAL_STORAGE_KEY, newMode);

  const modeToApply = calculateAppliedMode(newMode);
  applyThemeClass(modeToApply);
}

function setupSystemModeListener() {
  if (typeof window === 'undefined') return;

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handler = (e: MediaQueryListEvent) => {
    if (selectedThemeMode.value === 'system') {
      applyThemeClass(e.matches ? 'dark' : 'light');
    }
  };

  mediaQuery.addEventListener('change', handler);
}

watch(
  selectedThemeMode,
  (newMode) => {
    const modeToApply = calculateAppliedMode(newMode);
    applyThemeClass(modeToApply);
  },
  { immediate: false },
);

setupSystemModeListener();

export function useTheme() {
  return {
    selectedThemeMode,
    appliedThemeClass,
    applyTheme,
    initializeTheme,
  };
}
