<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { House, ListTodo, CalendarDays, Lock, ChevronLeft } from '@lucide/vue';
import { useGroups } from '@/modules/groups/composables/useGroups';

const router = useRouter();
const { t } = useI18n();

const { contextGroupId } = useGroups();

const groupLinks = computed(() => {
  const params = { groupId: contextGroupId.value };
  return [
    { key: 'dashboard', icon: House, to: { name: 'group-dashboard', params } },
    { key: 'tasks', icon: ListTodo, to: { name: 'group-tasks', params } },
    {
      key: 'schedule',
      icon: CalendarDays,
      to: { name: 'group-schedule', params },
    },
    { key: 'private', icon: Lock, to: { name: 'private-todos' } },
  ];
});

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    void router.push(
      contextGroupId.value
        ? { name: 'group-tasks', params: { groupId: contextGroupId.value } }
        : { name: 'groups' },
    );
  }
};
</script>

<template>
  <div class="w-full p-4 max-w-200 my-0 mx-0 md:my-10 md:mx-auto">
    <div class="flex flex-col items-center text-center py-5 max-xs:py-2.5">
      <div
        class="font-display text-[96px] font-bold text-on-ghost leading-none mb-4 tracking-[-0.02em] max-md:text-[72px] max-xs:text-[64px]"
      >
        404
      </div>
      <h1
        class="font-display text-[32px] font-semibold text-on-ghost m-0 mb-3 max-md:text-[24px]"
      >
        {{ t('common.not_found.title') }}
      </h1>
      <p
        class="text-base text-on-ghost-muted m-0 mb-12 max-w-125 max-md:text-sm max-md:mb-8"
      >
        {{ t('common.not_found.description') }}
      </p>

      <div v-if="contextGroupId" class="w-full mb-8">
        <div
          class="grid w-full gap-3 grid-cols-[repeat(auto-fit,minmax(280px,1fr))] max-md:grid-cols-1"
        >
          <router-link
            v-for="link in groupLinks"
            :key="link.key"
            :to="link.to"
            class="flex items-center gap-2 p-3 bg-surface border border-ghost-border shadow-input rounded-xl no-underline transition-all duration-150 ease cursor-pointer hover:bg-surface-highlight"
          >
            <div
              class="shrink-0 w-10 h-10 flex items-center justify-center text-on-ghost-muted"
            >
              <component :is="link.icon" :size="24" />
            </div>
            <div class="flex-1 text-left">
              <div class="text-base/tight font-semibold text-on-ghost">
                {{ t(`common.sidebar.${link.key}`) }}
              </div>
              <div class="text-sm text-on-ghost-muted">
                {{ t(`common.not_found.links.${link.key}`) }}
              </div>
            </div>
          </router-link>
        </div>
      </div>

      <div class="mt-4">
        <BaseButton variant="ghost" :icon="ChevronLeft" @click="goBack">
          {{ t('common.not_found.go_back') }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>
