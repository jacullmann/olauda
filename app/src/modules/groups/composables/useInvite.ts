import api from '@/api/client';
import { apiErrorCode, apiErrorMessage } from '@/api/errors';
import { groupPath } from '@/api/groupPath';
import i18n from '@/i18n';
import { useSession } from '@/modules/auth/composables/useSession';

const BANNED_FROM_GROUP = 'BANNED_FROM_GROUP';

/** Creating an invite link, and reading and accepting one someone shared. */
export function useInvite() {
  async function createInvite(
    groupId: string,
  ): Promise<{ ok: boolean; token?: string; error?: string }> {
    try {
      const { data } = await api.post<{ token: string }>(
        groupPath(groupId, '/invites'),
      );
      return { ok: true, token: data.token };
    } catch (error: unknown) {
      return {
        ok: false,
        error: apiErrorMessage(
          error,
          i18n.global.t('groups.errors.create_invite'),
        ),
      };
    }
  }

  async function getInvite(token: string): Promise<{
    ok: boolean;
    groupName?: string;
    avatarUrl?: string;
    memberCount?: number;
    alreadyMember?: boolean;
    groupId?: string;
  }> {
    try {
      const { data } = await api.get(`/invites/${encodeURIComponent(token)}`);
      return {
        ok: true,
        groupName: data.groupName,
        avatarUrl: data.avatarUrl,
        memberCount: data.memberCount,
        alreadyMember: data.alreadyMember === true,
        groupId: data.groupId ?? undefined,
      };
    } catch {
      // An invite that cannot be read is shown as invalid, which says it all.
      return { ok: false };
    }
  }

  async function acceptInvite(token: string): Promise<{
    ok: boolean;
    groupId?: string;
    alreadyMember?: boolean;
    error?: string;
  }> {
    try {
      const { data } = await api.post(
        `/invites/${encodeURIComponent(token)}/accept`,
      );
      const alreadyMember = data.alreadyMember === true;
      if (!alreadyMember) await useSession().checkAuthStatus();
      return { ok: true, groupId: data.groupId, alreadyMember };
    } catch (error: unknown) {
      return {
        ok: false,
        error:
          apiErrorCode(error) === BANNED_FROM_GROUP
            ? i18n.global.t('groups.errors.banned')
            : apiErrorMessage(error, i18n.global.t('groups.errors.join')),
      };
    }
  }

  return { createInvite, getInvite, acceptInvite };
}
