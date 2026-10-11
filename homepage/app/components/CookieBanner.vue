<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();

const dismissed = useCookie<boolean>('cookie_notice_dismissed', { maxAge: 60 * 60 * 24 * 180 });
</script>

<template>
  <Transition leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
    <div
      v-if="!dismissed"
      role="region"
      :aria-label="t('cookie.link')"
      class="fixed inset-x-4 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.25rem)] z-(--z-notice) flex items-center gap-4 rounded-3xl bg-action py-2 pr-2 pl-5 text-label text-on-action shadow-menu sm:right-auto sm:max-w-md md:bottom-4 md:left-4"
    >
      <p class="flex-1">
        {{ t('cookie.text') }}
        <NuxtLink
          :to="localePath('legal-privacy-policy')"
          class="link whitespace-nowrap decoration-on-action-muted"
        >
          {{ t('cookie.link') }}
        </NuxtLink>
      </p>
      <button
        type="button"
        class="h-9 shrink-0 cursor-pointer rounded-full bg-canvas px-4 font-medium text-on-ghost transition-opacity hover:opacity-85"
        @click="dismissed = true"
      >
        {{ t('cookie.dismiss') }}
      </button>
    </div>
  </Transition>
</template>
