<script setup lang="ts">
import { usePlatform } from '@/common/composables/usePlatform';

const props = withDefaults(
  defineProps<{
    keys: string[];
    separator?: string;
    on?: 'ghost' | 'action';
  }>(),
  {
    separator: '+',
    on: 'ghost',
  },
);

const { isMac, shortcutSymbol, optionSymbol, shiftSymbol } = usePlatform();

const KEY_SYMBOLS: Record<string, string> = {
  control: shortcutSymbol,
  ctrl: shortcutSymbol,
  meta: isMac ? '⌘' : 'Win',
  cmd: '⌘',
  command: '⌘',
  alt: optionSymbol,
  option: optionSymbol,
  shift: shiftSymbol,

  enter: '↵',
  return: '↵',
  backspace: '⌫',
  escape: 'Esc',
  esc: 'Esc',
  tab: '⇥',
};

const getDisplayKey = (key: string): string => {
  const val = KEY_SYMBOLS[key.toLowerCase()] || key;
  return val.length === 1 ? val.toUpperCase() : val;
};
</script>

<template>
  <span class="inline-flex items-center gap-1">
    <template v-for="(key, index) in keys" :key="index">
      <BaseKbd :on="on">{{ getDisplayKey(key) }}</BaseKbd>
      <span
        v-if="index < keys.length - 1"
        class="text-sm select-none font-sans"
        :class="'text-on-' + props.on + '-muted'"
      >
        {{ separator }}
      </span>
    </template>
  </span>
</template>
