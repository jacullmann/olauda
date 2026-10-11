<script setup lang="ts">
import { Menu, X } from '@lucide/vue';

const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const appLinks = useAppLinks();
const { y: scrollY } = useWindowScroll();

const menuOpen = ref(false);
const scrolled = computed(() => scrollY.value > 8);

const navLinks = [
  { labelKey: 'nav.features', route: 'features' },
  { labelKey: 'nav.about', route: 'about' },
  { labelKey: 'nav.contact', route: 'contact' },
] as const;

watch(
  () => route.fullPath,
  () => (menuOpen.value = false),
);

useHead({ bodyAttrs: { class: computed(() => (menuOpen.value ? 'overflow-hidden' : '')) } });
</script>

<template>
  <header
    class="sticky top-0 z-(--z-header) bg-canvas transition-[box-shadow] duration-300"
    :class="scrolled || menuOpen ? 'shadow-[0_1px_0_var(--color-ghost-border)]' : ''"
  >
    <nav class="page flex h-header items-center gap-10" :aria-label="t('nav.label')">
      <NuxtLink
        :to="localePath('index')"
        class="-ml-1 flex items-center gap-2.5 rounded-md px-1 py-1"
        :aria-label="t('nav.home')"
      >
        <img src="/favicon.svg" alt="" class="size-6" width="24" height="24" />
        <span class="text-[0.9375rem] font-semibold tracking-[-0.01em]">Olauda</span>
      </NuxtLink>

      <ul class="hidden items-center gap-7 md:flex">
        <li v-for="link in navLinks" :key="link.route">
          <NuxtLink
            :to="localePath(link.route)"
            class="text-sm text-on-ghost-muted transition-colors hover:text-on-ghost"
            active-class="text-on-ghost!"
          >
            {{ t(link.labelKey) }}
          </NuxtLink>
        </li>
      </ul>

      <div class="ml-auto hidden items-center gap-1 md:flex">
        <BaseButton :href="appLinks.login" target="_self">{{ t('common.login') }}</BaseButton>
        <BaseButton :href="appLinks.register" target="_self" variant="action">
          {{ t('common.getStarted') }}
        </BaseButton>
      </div>

      <BaseButton
        class="-mr-2 ml-auto md:hidden"
        :icon="menuOpen ? X : Menu"
        :aria-label="t(menuOpen ? 'nav.close_menu' : 'nav.open_menu')"
        :aria-expanded="menuOpen"
        aria-controls="mobile-nav"
        @click="menuOpen = !menuOpen"
      />
    </nav>

    <Transition
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
    >
      <div
        v-if="menuOpen"
        id="mobile-nav"
        class="fixed inset-x-0 top-header bottom-0 z-(--z-mobile-nav) flex flex-col bg-canvas md:hidden"
      >
        <ul class="page flex flex-col pt-6">
          <li v-for="link in navLinks" :key="link.route" class="border-b border-ghost-border">
            <NuxtLink
              :to="localePath(link.route)"
              class="block py-4 font-serif text-title"
              @click="menuOpen = false"
            >
              {{ t(link.labelKey) }}
            </NuxtLink>
          </li>
        </ul>
        <div class="page mt-auto flex flex-col gap-2 pb-8">
          <BaseButton :href="appLinks.register" target="_self" variant="action" size="lg">
            {{ t('common.getStarted') }}
          </BaseButton>
          <BaseButton :href="appLinks.login" target="_self" size="lg">
            {{ t('common.login') }}
          </BaseButton>
        </div>
      </div>
    </Transition>
  </header>
</template>
