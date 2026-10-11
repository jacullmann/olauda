<script setup lang="ts">
import { Lock, UsersRound } from '@lucide/vue';

const { t } = useI18n();

const layers = [
  {
    key: 'everyone',
    icon: UsersRound,
    items: ['tasks', 'changes', 'announcements', 'roles'],
  },
  {
    key: 'you',
    icon: Lock,
    items: ['checks', 'courses', 'private'],
  },
] as const;
</script>

<template>
  <!-- Olauda has two layers: what the group shares and what stays personal. The page
       sets them side by side so the split reads at a glance. -->
  <section class="page pt-section">
    <div class="grid gap-y-section lg:grid-cols-2">
      <article
        v-for="(layer, index) in layers"
        :key="layer.key"
        class="flex flex-col"
        :class="
          index === 0
            ? 'lg:border-r lg:border-ghost-border lg:pr-[calc(var(--spacing-gutter)*1.5)]'
            : 'lg:pl-[calc(var(--spacing-gutter)*1.5)]'
        "
      >
        <component :is="layer.icon" :size="24" aria-hidden="true" />
        <h2 class="mt-5 max-w-[16ch] text-title">{{ t(`home.${layer.key}.title`) }}</h2>
        <p class="mt-5 max-w-prose text-lede text-on-ghost-muted">
          {{ t(`home.${layer.key}.body`) }}
        </p>

        <div class="mt-10">
          <HomeClassRoster v-if="layer.key === 'everyone'" />
          <HomeTaskSpecimen v-else />
        </div>

        <dl class="mt-10 grid gap-x-8 sm:grid-cols-2">
          <div v-for="item in layer.items" :key="item" class="border-t border-ghost-border py-5">
            <dt class="font-semibold">{{ t(`home.${layer.key}.items.${item}.title`) }}</dt>
            <dd class="mt-1.5 text-on-ghost-muted">
              {{ t(`home.${layer.key}.items.${item}.body`) }}
            </dd>
          </div>
        </dl>
      </article>
    </div>
  </section>
</template>
