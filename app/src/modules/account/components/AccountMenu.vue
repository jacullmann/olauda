<script setup lang="ts">
import { ref } from 'vue';
import { LogOut, Settings } from '@lucide/vue';
import AccountMenuPersonalization from './AccountMenuPersonalization.vue';
import AccountMenuTheme from './AccountMenuTheme.vue';
import AccountMenuLocale from './AccountMenuLocale.vue';
import { useI18n } from 'vue-i18n';
import { useAccountMenu } from '@/modules/account/composables/useAccountMenu';
import type { UserData } from '@/modules/account/stores/useUserStore';

const { t } = useI18n();

withDefaults(
  defineProps<{
    email: string;
    userData: UserData | null;
    expanded?: boolean;
    iconOnly?: boolean;
    tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right';
  }>(),
  {
    expanded: true,
    iconOnly: false,
    tooltipPlacement: 'right',
  },
);

const emit = defineEmits<{
  (e: 'logout'): void;
}>();

const root = ref<HTMLElement | null>(null);
const popupInner = ref<HTMLElement | null>(null);
const firstMenuBtnRef = ref<{ focus: () => void } | null>(null);
const baseMenuRef = ref<{
  startClose: () => void;
  menuEl: HTMLElement | null;
} | null>(null);

const { open, popupStyle, handleLogout, openAccountSettings, toggle, cancel } =
  useAccountMenu(emit, {
    root,
    popupInner,
    firstMenuBtnRef,
    baseMenu: baseMenuRef,
  });
</script>

<template>
  <div ref="root" class="relative flex">
    <BaseTooltip :content="email" :placement="tooltipPlacement" class="w-full">
      <button
        v-wave
        type="button"
        class="relative flex items-center p-1 rounded-full w-full bg-transparent hover:bg-ghost-hover active:bg-ghost-hover transition-hover cursor-pointer text-left touch-target after:min-w-12 after:min-h-12"
        @click="toggle"
      >
        <BaseAvatar
          :name="email"
          :aria-expanded="open"
          :title="t('auth.account_menu.label')"
          :size="8"
          @keydown.enter="toggle"
          @keydown.space.prevent="toggle"
        />

        <span
          v-if="!iconOnly"
          class="sidebar-fade flex flex-col gap-1 min-w-0 max-w-44 ml-2"
          :class="expanded ? 'opacity-100' : 'opacity-0'"
        >
          <span class="text-sm/4 font-medium text-on-ghost truncate">{{
            email
          }}</span>
          <span
            v-if="userData?.username"
            class="text-xs/3 font-normal text-on-ghost-muted truncate"
            >{{ userData.username }}</span
          >
        </span>
      </button>
    </BaseTooltip>

    <BaseMenu
      :ref="
        (el: any) => {
          baseMenuRef = el;
          popupInner = el?.menuEl ?? null;
        }
      "
      :open="open"
      :title="email"
      class="fixed pointer-events-auto z-[var(--z-modal)] origin-top-left min-w-80"
      :style="popupStyle"
      role="menu"
      :aria-label="t('auth.account_menu.label')"
      @click.stop
      @cancel="cancel"
    >
      <!-- Desktop only: the sheet shows the email as BaseMenu's sticky title. -->
      <div
        class="hidden md:flex px-3 py-1.5 font-semibold text-sm text-on-ghost overflow-hidden text-ellipsis whitespace-nowrap"
        :title="email"
      >
        {{ email }}
      </div>

      <BaseMenuDivider class="hidden md:block" />

      <BaseMenuButton
        ref="firstMenuBtnRef"
        :icon="Settings"
        @click="openAccountSettings"
      >
        {{ t('auth.account_settings.title') }}
      </BaseMenuButton>

      <AccountMenuPersonalization />

      <BaseMenuDivider />

      <AccountMenuTheme />

      <AccountMenuLocale />

      <BaseMenuDivider />

      <BaseMenuButton :icon="LogOut" @click="handleLogout">
        {{ t('auth.actions.logout') }}
      </BaseMenuButton>
    </BaseMenu>
  </div>
</template>
