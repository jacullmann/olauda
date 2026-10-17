import api, { unwrap } from '@/api/client';
import { apiErrorCode, apiErrorMessage } from '@/api/errors';
import { queryClient } from '@/api/queryClient';
import i18n from '@/i18n';
import { useSession } from '@/modules/auth/composables/useSession';
import { groupKeys } from '@/modules/groups/utils/groupQueries';

/** Creating an invite link, and reading and accepting one someone shared. */
export function useInvite() {
  async function createInvite(
    groupId: string,
  ): Promise<{ ok: boolean; token?: string; error?: string }> {
    try {
      const { token } = await unwrap(
        api.POST('/groups/{group_id}/invites', {
          params: { path: { group_id: groupId } },
        }),
      );
      void queryClient.invalidateQueries({
        queryKey: groupKeys.invites(groupId),
      });
      return { ok: true, token };
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
      const invite = await unwrap(
        api.GET('/invites/{token}', { params: { path: { token } } }),
      );
      return {
        ok: true,
        groupName: invite.groupName,
        avatarUrl: invite.avatarUrl ?? undefined,
        memberCount: invite.memberCount,
        alreadyMember: invite.alreadyMember,
        groupId: invite.groupId ?? undefined,
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
      const { groupId, alreadyMember } = await unwrap(
        api.POST('/invites/{token}/accept', { params: { path: { token } } }),
      );
      if (!alreadyMember) await useSession().checkAuthStatus();
      return { ok: true, groupId, alreadyMember };
    } catch (error: unknown) {
      return {
        ok: false,
        error:
          apiErrorCode(error) === 'BANNED_FROM_GROUP'
            ? i18n.global.t('groups.errors.banned')
            : apiErrorMessage(error, i18n.global.t('groups.errors.join')),
      };
    }
  }

  return { createInvite, getInvite, acceptInvite };
}
