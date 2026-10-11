<script setup lang="ts">
import { computed, markRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Layers, UsersRound } from '@lucide/vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const sections = computed(() => [
  {
    id: 'admin-users',
    label: t('admin.nav.users'),
    icon: markRaw(UsersRound),
  },
  {
    id: 'admin-groups',
    label: t('admin.nav.groups'),
    icon: markRaw(Layers),
  },
]);

// Kept as it was while a detail page shows in front of the kept-alive lists.
const activeSection = computed<string>((previous) => {
  const name = String(route.name);
  return sections.value.some((section) => section.id === name)
    ? name
    : (previous ?? 'admin-users');
});
</script>

<template>
  <PageHeader>{{ t('admin.directory.title') }}</PageHeader>
  <nav :aria-label="t('admin.directory.title')" class="mb-5">
    <BaseTabs
      :items="sections"
      :active-id="activeSection"
      @change="(name) => router.push({ name })"
    />
  </nav>

  <RouterView v-slot="{ Component }">
    <!-- Switching between the lists keeps each one as it was left. -->
    <KeepAlive :include="['SuperAdminUsers', 'SuperAdminGroups']">
      <component :is="Component" />
    </KeepAlive>
  </RouterView>
</template>
