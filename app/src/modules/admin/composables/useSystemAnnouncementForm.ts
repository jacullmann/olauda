import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/api';
import { apiErrorMessage } from '@/api/errors';
import { ANNOUNCEMENT_MAX_CHARS } from '@/modules/announcements/types';
import {
  draftFrom,
  toSaveRequest,
  type DraftField,
} from '../utils/systemAnnouncementDraft';
import type { AdminSystemAnnouncement } from '../types';

const ENDPOINT = '/admin/system-announcements';

/** Posts a new announcement, or reschedules `announcement` when given. */
export function useSystemAnnouncementForm(
  announcement: AdminSystemAnnouncement | null,
) {
  const { t } = useI18n();

  const draft = reactive(draftFrom(announcement, new Date()));
  const fieldErrors = ref<Partial<Record<DraftField, string>>>({});
  const submitError = ref('');
  const submitting = ref(false);

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

    submitting.value = true;
    try {
      if (announcement) {
        await api.put(`${ENDPOINT}/${announcement.id}`, result.request);
      } else {
        await api.post(ENDPOINT, result.request);
      }
      return true;
    } catch (e) {
      submitError.value = apiErrorMessage(
        e,
        t('admin.announcements.errors.save'),
      );
      return false;
    } finally {
      submitting.value = false;
    }
  }

  return { draft, fieldErrors, submitError, submitting, submit };
}
