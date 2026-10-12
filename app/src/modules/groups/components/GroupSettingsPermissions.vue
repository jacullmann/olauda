<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/client';
import { groupPath } from '@/api/groupPath';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';
import { useToast } from '@/common/composables/useToast';
import { useSession } from '@/modules/auth/composables/useSession';
import { useGroups } from '@/modules/groups/composables/useGroups';
import type {
  ConfigurablePermissionKey,
  PermissionMatrix,
  PermissionRole,
} from '@/modules/groups/types';

const i18n = useI18n();
const { t } = i18n;

const props = defineProps<{
  canManage: boolean;
}>();

interface PermissionSection {
  category: 'general' | 'tasks' | 'info' | 'moderation';
  /** Mirrors `Permission::lowest_role`, which the server enforces. */
  permissions: { key: ConfigurablePermissionKey; lowestRole: PermissionRole }[];
}

const PERMISSION_SECTIONS: PermissionSection[] = [
  {
    category: 'general',
    permissions: [
      { key: 'edit_group_profile', lowestRole: 'user' },
      { key: 'invite_members', lowestRole: 'user' },
      { key: 'edit_subjects_courses', lowestRole: 'moderator' },
      { key: 'edit_schedule', lowestRole: 'moderator' },
    ],
  },
  {
    category: 'tasks',
    permissions: [
      { key: 'create_items', lowestRole: 'user' },
      { key: 'upload_images', lowestRole: 'user' },
      { key: 'manage_notes', lowestRole: 'user' },
    ],
  },
  {
    category: 'info',
    permissions: [
      { key: 'manage_schedule_changes', lowestRole: 'user' },
      { key: 'manage_announcements', lowestRole: 'moderator' },
    ],
  },
  {
    category: 'moderation',
    permissions: [
      { key: 'moderate_members', lowestRole: 'moderator' },
      { key: 'edit_other_content', lowestRole: 'moderator' },
      { key: 'delete_other_content', lowestRole: 'moderator' },
    ],
  },
];

const ROLES: { role: PermissionRole; label: string }[] = [
  { role: 'user', label: 'all' },
  { role: 'moderator', label: 'moderators' },
  { role: 'admin', label: 'admins' },
];

function roleOptions(lowestRole: PermissionRole) {
  const lowest = ROLES.findIndex(({ role }) => role === lowestRole);
  return ROLES.slice(lowest).map(({ role, label }) => ({
    label: t(`groups.settings.permissions.options.${label}`),
    value: role,
  }));
}

const toast = useToast();
const { checkAuthStatus } = useSession();
const { activeGroupPermissions } = useGroups();
const groupId = useGroupPageId();

const permissions = ref<PermissionMatrix | null>(null);
const loading = ref(true);
const saving = ref(false);

async function fetchPermissions() {
  // Only managers may call the admin endpoint; everyone else gets the
  // read-only matrix that the group status already carries.
  if (!props.canManage) {
    permissions.value = activeGroupPermissions.value;
    loading.value = false;
    return;
  }

  loading.value = true;
  try {
    const { data } = await api.get<{ permissions: PermissionMatrix }>(
      groupPath(groupId, '/admin/permissions'),
    );
    permissions.value = data.permissions;
  } catch {
    toast.error(t('groups.settings.permissions.errors.load'));
  } finally {
    loading.value = false;
  }
}

async function savePermission(
  key: ConfigurablePermissionKey,
  role: PermissionRole,
) {
  if (!props.canManage || !permissions.value) return;

  saving.value = true;
  const previousRole = permissions.value[key];
  permissions.value[key] = role;

  try {
    await api.patch(groupPath(groupId, '/admin/permissions'), {
      permissions: { [key]: role },
    });
    await checkAuthStatus();
  } catch {
    permissions.value[key] = previousRole;
    toast.error(t('groups.settings.permissions.errors.save'));
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void fetchPermissions();
});
</script>

<template>
  <div>
    <BasePageHeader>
      <template #info>
        <BaseInfoButton
          :tooltip="t('groups.settings.permissions.info.tooltip')"
          :title="t('groups.settings.permissions.title')"
        >
          <h3>{{ t('groups.settings.permissions.info.headline') }}</h3>
        </BaseInfoButton>
      </template>
    </BasePageHeader>

    <div v-if="loading" class="flex flex-col justify-center items-center py-10">
      <BaseSpinner size="32px" />
      <span class="text-sm text-on-ghost-muted mt-2">{{
        t('groups.settings.permissions.list.loading')
      }}</span>
    </div>

    <div v-else-if="permissions" class="flex flex-col gap-4 relative">
      <div
        v-if="saving"
        class="absolute inset-0 bg-canvas/30 rounded-xl flex items-center justify-center z-10"
      >
        <BaseSpinner size="24px" />
      </div>

      <div v-if="!canManage" class="text-xs">
        {{ t('groups.settings.permissions.list.admin_only_warning') }}
      </div>

      <section
        v-for="section in PERMISSION_SECTIONS"
        :key="section.category"
        class="flex flex-col gap-2"
      >
        <h3>
          {{ t(`groups.settings.permissions.categories.${section.category}`) }}
        </h3>

        <div class="flex flex-col max-md:-mx-6">
          <BaseList
            v-for="({ key, lowestRole }, index) in section.permissions"
            :key="key"
            select
            :separator="index !== section.permissions.length - 1"
            :model-value="permissions[key]"
            :options="roleOptions(lowestRole)"
            :title="t(`groups.settings.permissions.items.${key}.title`)"
            :disabled="!canManage || saving"
            @update:model-value="savePermission(key, $event as PermissionRole)"
          >
            <template #label>
              {{ t(`groups.settings.permissions.items.${key}.title`) }}
            </template>
            <template
              v-if="
                i18n.te(`groups.settings.permissions.items.${key}.description`)
              "
              #desc
            >
              {{ t(`groups.settings.permissions.items.${key}.description`) }}
            </template>
          </BaseList>
        </div>
      </section>
    </div>
  </div>
</template>
