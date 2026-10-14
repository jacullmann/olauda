<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import AdminTabBar from '@/modules/admin/components/AdminTabBar.vue';
import { useAdminNav } from '@/modules/admin/composables/useAdminNav';
import { useAdminStats } from '@/modules/admin/composables/useAdminStats';

const { t } = useI18n();
const { loadStats } = useAdminStats();
const { navItems, activeTab, selectTab } = useAdminNav();

// The only place the stats are fetched on entry; child pages share the result.
onMounted(loadStats);
</script>

<template>
  <div class="flex flex-1 flex-col bg-canvas text-on-ghost">
    <div class="flex min-h-0 flex-1">
      <!-- Stretched to the row's height, so a page can fill it with min-h-full. -->
      <main class="min-w-0 flex-1 px-4 pt-5 pb-12 md:px-8 md:pt-7 md:pb-16">
        <router-view v-slot="{ Component: page }">
          <!-- A list keeps its place behind a page opened from it, such as an
               account opened from the log, while the admin area stays open. -->
          <KeepAlive :include="['AdminDirectoryLayout', 'AdminLogPage']">
            <component :is="page" />
          </KeepAlive>
        </router-view>
      </main>
    </div>
    <AdminTabBar
      :label="t('navigation.super_admin')"
      :items="navItems"
      :active-id="activeTab ?? ''"
      @change="selectTab"
    />
  </div>
</template>
