<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useUserStore } from '@/stores/userStore';
import { useCreateGroupModal } from '@/stores/modalStore';
import { useAppAuth } from '@/modules/auth/composables/useAppAuth';
import { Plus, UsersRound } from '@lucide/vue';
import api from '@/api/api';
import { useI18n } from 'vue-i18n';
import Avatar from '@/modules/auth/components/Avatar.vue';
import { entranceDelay } from '@/modules/tasks/utils/entrance';
import { menuAnchor, type MenuAnchor } from '@/modules/tasks/utils/menuAnchor';
import { useLongPress } from '@/common/composables/useLongPress';
import { useToast } from '@/common/composables/useToast';
import GroupContextMenu from '../components/GroupContextMenu.vue';

const { t } = useI18n();

const router = useRouter();
const userStore = useUserStore();
const createGroupModal = useCreateGroupModal();
const { user } = storeToRefs(userStore);
const { userGroups } = useAppAuth();

const loading = ref(false);
const navigatingGroupId = ref<string | null>(null);
const allGroups = ref<
  Array<{ id: string; name: string; memberCount: number; created_at: string }>
>([]);

const isSuperadmin = computed(() => user.value?.role === 'superadmin');

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    admin: t('common.roles.admin'),
    moderator: t('common.roles.moderator'),
    user: t('common.roles.member'),
    superadmin: t('navigation.super_admin'),
  };
  return map[role] || role;
}

async function navigateToGroup(groupId: string) {
  if (navigatingGroupId.value) return;
  navigatingGroupId.value = groupId;

  try {
    await router.push({ name: 'group-dashboard', params: { groupId } });
  } catch (err) {
    console.error('Navigation error:', err);
  } finally {
    navigatingGroupId.value = null;
  }
}

async function loadAllGroups() {
  if (!isSuperadmin.value) return;
  loading.value = true;
  try {
    const { data } = await api.get('/admin/groups');
    allGroups.value = data;
  } catch (err) {
    console.error('Failed to load groups:', err);
    useToast().error(t('admin.groups.errors.load'));
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadAllGroups();
});

const isMenuOpen = ref(false);
const menuGroupId = ref<string | null>(null);
const menuPosition = ref<MenuAnchor | null>(null);
const menuGroup = computed(
  () => userGroups.value.find((g) => g.id === menuGroupId.value) ?? null,
);

// One hold is tracked for the whole list and resolved to a row from the event
// target, so each row needs no gesture state of its own.
const { handlers: longPressHandlers } = useLongPress(
  (event) => {
    const row = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      '[data-group-id]',
    );
    if (!row?.dataset.groupId) return;

    menuGroupId.value = row.dataset.groupId;
    menuPosition.value = menuAnchor(event);
    isMenuOpen.value = true;
  },
  { within: '[data-group-id]', grow: '[data-group-id]' },
);

/** The header and its action, then the groups one by one. */
const GROUPS_HEADER_ENTRANCE_ORDER = 1;
const GROUPS_LIST_ENTRANCE_ORDER = 2;
</script>

<template>
  <div class="flex flex-1 flex-col md:p-4">
    <section v-if="userGroups.length > 0" class="max-md:pt-4 mb-9">
      <div
        class="animate-enter"
        :style="{
          '--enter-delay': entranceDelay(GROUPS_HEADER_ENTRANCE_ORDER),
        }"
      >
        <PageHeader class="max-md:px-4">
          <template #action>
            <BaseTooltip
              :content="t('groups.list.tooltip.create_group')"
              placement="bottom"
            >
              <BaseButton
                variant="action"
                :icon="Plus"
                icon-classes="size-6"
                @click="createGroupModal.open()"
              />
            </BaseTooltip>
          </template>
        </PageHeader>
      </div>
      <div class="flex flex-col" v-on="longPressHandlers">
        <div
          v-for="(group, index) in userGroups"
          :key="group.id"
          :data-group-id="group.id"
          class="long-press-target animate-enter"
          :style="{
            '--enter-delay': entranceDelay(GROUPS_LIST_ENTRANCE_ORDER + index),
          }"
        >
          <BaseList
            :separator="index !== userGroups.length - 1"
            :disabled="navigatingGroupId === group.id"
            :chevron="false"
            @click="navigateToGroup(group.id)"
          >
            <template #icon>
              <Avatar
                :name="group.name"
                :picture="group.avatarUrl"
                :size="10"
              />
            </template>

            <template #label>{{ group.name }}</template>

            <template #desc>{{ roleLabel(group.role) }}</template>
          </BaseList>
        </div>
      </div>

      <GroupContextMenu
        :open="isMenuOpen"
        :group="menuGroup"
        :anchor="menuPosition"
        @close="isMenuOpen = false"
      />
    </section>

    <section
      v-if="!isSuperadmin && userGroups.length === 0 && !loading"
      class="flex flex-1 flex-col max-md:p-4 animate-enter"
      :style="{ '--enter-delay': entranceDelay(GROUPS_HEADER_ENTRANCE_ORDER) }"
    >
      <BaseEmptyState
        class="flex-1"
        :icon="UsersRound"
        :primary-action="() => createGroupModal.open()"
      >
        {{ t('groups.list.no_groups') }}
        <template #message>{{ t('groups.list.join_group_text') }}</template>
        <template #primary-action-label>{{
          t('groups.list.create_group')
        }}</template>
      </BaseEmptyState>
    </section>

    <div
      v-if="loading"
      class="flex justify-center p-10 animate-enter"
      :style="{ '--enter-delay': entranceDelay(GROUPS_HEADER_ENTRANCE_ORDER) }"
    >
      <div
        class="w-7 h-7 border-2 border-ghost-border border-t-on-ghost rounded-full animate-spin"
      ></div>
    </div>
  </div>
</template>
