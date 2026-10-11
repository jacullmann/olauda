<script setup lang="ts">
import type { Component } from 'vue';

const props = withDefaults(
  defineProps<{
    href?: string;
    target?: string;
    type?: 'button' | 'submit' | 'reset';
    /** The inverse variants sit on an action-coloured background. */
    variant?: 'action' | 'ghost' | 'surface' | 'inverse' | 'inverse-ghost';
    size?: 'sm' | 'md' | 'lg';
    icon?: Component;
  }>(),
  {
    href: undefined,
    target: undefined,
    type: 'button',
    variant: 'ghost',
    size: 'md',
    icon: undefined,
  },
);

const slots = useSlots();
const iconOnly = computed(() => Boolean(props.icon) && !slots.default);

const variantClasses = {
  action: 'bg-action text-on-action hover:bg-action-hover',
  ghost: 'text-on-ghost hover:bg-ghost-hover',
  surface: 'border border-ghost-border bg-surface text-on-ghost shadow-input hover:bg-ghost-hover',
  inverse: 'bg-on-action text-action hover:bg-on-action/88',
  'inverse-ghost': 'text-on-action hover:bg-on-action/12',
} as const;

const sizeClasses = computed(() => {
  if (iconOnly.value) return { sm: 'size-8', md: 'size-10', lg: 'size-12' }[props.size];
  return {
    sm: 'h-8 px-3.5 text-sm/4',
    md: 'h-10 px-5 text-sm/4',
    lg: 'h-12 px-6 text-[0.9375rem]/5',
  }[props.size];
});

const tagAttrs = computed(() =>
  props.href
    ? {
        href: props.href,
        target: props.target,
        rel: props.target === '_blank' ? 'noopener noreferrer' : undefined,
      }
    : { type: props.type },
);
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    v-bind="tagAttrs"
    :class="[variantClasses[variant], sizeClasses]"
    class="touch-target relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-colors duration-(--duration-hover) select-none"
  >
    <component :is="icon" v-if="icon" :size="size === 'sm' ? 16 : 18" aria-hidden="true" />
    <slot />
  </component>
</template>
