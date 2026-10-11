<script setup lang="ts">
import { UserRoundPlus, Copy, Check, Undo2 } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { formatDate } from '@/utils/date-formatter';
import { ref } from 'vue';
import { useAppAuth } from '@/modules/auth/composables/useAppAuth';
import { useGroupPageId } from '@/core/composables/useGroupPageId';
import { useInviteModal } from '@/stores/modalStore';
import { useToast } from '@/common/composables/useToast';
import { useAbsoluteUrl } from '@/common/composables/useAbsoluteUrl';
import { inviteRoute } from '@/modules/auth/utils/routes';
import type { GroupInviteLog } from '@/modules/groups/types';
import { useGroupInvites } from '@/modules/groups/composables/useGroupInvites';

const {
  invites,
  loadingInvites: loading,
  loadInvites,
  revokeInvite,
} = useGroupInvites();

const { t } = useI18n();
const { createInvite } = useAppAuth();
const groupId = useGroupPageId();
const inviteModal = useInviteModal();
const toast = useToast();
const { absoluteUrl } = useAbsoluteUrl();

const loadingInvite = ref(false);
const copiedId = ref<string | null>(null);

async function inviteMember() {
  loadingInvite.value = true;
  try {
    const res = await createInvite(groupId);
    if (res.ok && res.token) {
      inviteModal.open({ groupId: groupId, token: res.token });
      void loadInvites();
    } else {
      toast.error(res.error || t('groups.errors.create_invite'));
    }
  } catch (err) {
    console.error('Failed to generate invite link:', err);
    toast.error(t('groups.errors.create_invite'));
  } finally {
    loadingInvite.value = false;
  }
}

async function copyLink(inviteId: string, token: string) {
  try {
    await navigator.clipboard.writeText(getInviteUrl(token));
    copiedId.value = inviteId;
    setTimeout(() => {
      if (copiedId.value === inviteId) {
        copiedId.value = null;
      }
    }, 3000);
  } catch {
    toast.error(t('common.errors.copy_link'));
  }
}

function isInviteActive(
  invite: GroupInviteLog,
): invite is GroupInviteLog & { token: string } {
  return (
    invite.token !== null &&
    invite.usedAt === null &&
    invite.revokedAt === null &&
    new Date(invite.expiresAt) > new Date()
  );
}

function getBadgeClass(invite: GroupInviteLog): string {
  if (invite.usedAt !== null) {
    return 'text-accent';
  }
  if (invite.revokedAt !== null) {
    return 'text-danger';
  }
  if (new Date(invite.expiresAt) <= new Date()) {
    return 'text-on-ghost-subtle';
  }
  return 'text-success';
}

function getBadgeLabel(invite: GroupInviteLog): string {
  if (invite.usedAt !== null)
    return t('groups.settings.members.invite_links.status.used');
  if (invite.revokedAt !== null)
    return t('groups.settings.members.invite_links.status.revoked');
  if (new Date(invite.expiresAt) <= new Date())
    return t('groups.settings.members.invite_links.status.expired');
  return t('groups.settings.members.invite_links.status.active');
}

function getInviteUrl(token: string): string {
  return absoluteUrl(inviteRoute(token));
}
</script>

<template>
  <div class="flex flex-1 flex-col">
    <div class="flex items-center justify-between gap-4 mb-4">
      <BaseButton
        type="button"
        variant="action"
        :loading="loadingInvite"
        :icon="UserRoundPlus"
        class="gap-2 shrink-0"
        @click="inviteMember"
      >
        {{ t('groups.settings.members.invite_links.generate_button') }}
      </BaseButton>
    </div>

    <div
      v-if="loading && invites.length === 0"
      class="flex justify-center p-8 bg-surface border border-ghost-border rounded-xl"
    >
      <BaseSpinner />
    </div>
    <BaseEmptyState
      v-else-if="invites.length === 0"
      class="flex-1"
      :icon="UserRoundPlus"
    >
      {{ t('groups.settings.members.invite_links.empty') }}
    </BaseEmptyState>
    <BaseTableWrapper v-else>
      <table>
        <thead>
          <tr>
            <th>{{ t('groups.settings.members.invite_links.table.link') }}</th>
            <th>
              {{ t('groups.settings.members.invite_links.table.status') }}
            </th>
            <th>{{ t('tasks.list.tasks.menu.info_modal.created_by') }}</th>
            <th>{{ t('tasks.list.tasks.menu.info_modal.created_at') }}</th>
            <th>
              {{ t('groups.settings.members.invite_links.table.expires_at') }}
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="invite in invites" :key="invite.id">
            <td v-if="isInviteActive(invite)" class="truncate select-all">
              {{ getInviteUrl(invite.token) }}
            </td>
            <td v-else class="truncate text-on-ghost-subtle">—</td>
            <td :class="getBadgeClass(invite)" class="text-sm font-bold">
              {{ getBadgeLabel(invite) }}
            </td>
            <td>
              {{
                invite.createdByName ||
                t('groups.settings.members.invite_links.system')
              }}
            </td>
            <td>
              {{ formatDate(invite.createdAt, t) }}
            </td>
            <td>
              <template v-if="invite.usedAt"
                >{{ t('groups.settings.members.invite_links.used_by') }}
                <strong>{{
                  invite.usedByName || t('common.selection.unknown')
                }}</strong>
                ({{ formatDate(invite.usedAt, t) }})
              </template>
              <template v-else-if="invite.revokedAt"
                >{{ t('groups.settings.members.invite_links.revoked_by') }}
                <strong>{{
                  invite.revokedByName || t('common.selection.unknown')
                }}</strong>
                ({{ formatDate(invite.revokedAt, t) }})
              </template>
              <template v-else>
                {{ formatDate(invite.expiresAt, t) }}
              </template>
            </td>

            <td class="py-0! px-2! min-w-0! space-x-2">
              <BaseTooltip
                v-if="isInviteActive(invite)"
                :content="t('auth.groups.invite.copy_button')"
                placement="bottom"
              >
                <BaseButton
                  variant="ghost"
                  size="sm"
                  :icon="copiedId === invite.id ? Check : Copy"
                  @click="copyLink(invite.id, invite.token)"
                />
              </BaseTooltip>

              <BaseTooltip
                v-if="isInviteActive(invite)"
                :content="
                  t('groups.settings.members.invite_links.actions.revoke')
                "
                placement="bottom"
              >
                <BaseButton
                  variant="ghost"
                  size="sm"
                  :icon="Undo2"
                  @click="revokeInvite(invite.id)"
                />
              </BaseTooltip>
            </td>
          </tr>
        </tbody>
      </table>
    </BaseTableWrapper>
  </div>
</template>
