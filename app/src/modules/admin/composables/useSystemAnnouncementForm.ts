import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { ANNOUNCEMENT_MAX_CHARS } from '@/modules/announcements/types';
import {
  draftFrom,
  toSaveRequest,
  type DraftField,
} from '@/modules/admin/utils/systemAnnouncementDraft';
import type {
  AdminSystemAnnouncement,
  SaveSystemAnnouncementRequest,
} from '@/modules/admin/types';
import { invalidateSystemAnnouncements } from '@/modules/admin/utils/adminQueries';

/** Posts a new announcement, or reschedules `announcement` when given. */
export function useSystemAnnouncementForm(
  announcement: AdminSystemAnnouncement | null,
) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const draft = reactive(draftFrom(announcement, new Date()));
  const fieldErrors = ref<Partial<Record<DraftField, string>>>({});
  const submitError = ref('');

  const save = useMutation({
    mutationFn: (body: SaveSystemAnnouncementRequest) =>
      announcement
        ? unwrap(
            api.PUT('/admin/system-announcements/{id}', {
              params: { path: { id: announcement.id } },
              body,
            }),
          )
        : unwrap(api.POST('/admin/system-announcements', { body })),
    onSuccess: () => invalidateSystemAnnouncements(queryClient),
  });

  /** Resolves whether the announcement was saved. */
  async function submit(): Promise<boolean> {
    fieldErrors.value = {};
    submitError.value = '';

    const result = toSaveRequest(draft, new Date());
    if (!result.ok) {
      fieldErrors.value = {
        [result.field]: t(`admin.announcements.form.errors.${result.error}`, {
          max: ANNOUNCEMENT_MAX_CHARS,
        }),
      };
      return false;
    }

    try {
      await save.mutateAsync(result.request);
      return true;
    } catch (e) {
      submitError.value = apiErrorMessage(
        e,
        t('admin.announcements.errors.save'),
      );
      return false;
    }
  }

  return {
    draft,
    fieldErrors,
    submitError,
    submitting: save.isPending,
    submit,
  };
}
