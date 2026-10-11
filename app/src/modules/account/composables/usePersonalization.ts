import { useI18n } from 'vue-i18n';
import api from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { useUserStore } from '@/modules/account/stores/useUserStore';

export function usePersonalization() {
  const { t } = useI18n();
  const userStore = useUserStore();

  /**
   * Applies the setting optimistically and rolls it back if the save fails.
   * Resolves to the saved setting, or `null` when nothing was saved.
   */
  async function setPersonalization(value: boolean): Promise<boolean | null> {
    if (userStore.savingPersonalization || !userStore.user) return null;

    const previous = userStore.user.personalized;
    userStore.savingPersonalization = true;
    userStore.updateUser({ personalized: value });
    try {
      const { data } = await api.patch('/user/personalization', {
        personalized: value,
      });
      if (!data.ok) {
        userStore.updateUser({ personalized: previous });
        return null;
      }

      userStore.updateUser({ personalized: data.personalized });
      return data.personalized;
    } catch (e: unknown) {
      userStore.updateUser({ personalized: previous });
      useToast().error(
        apiErrorMessage(e, t('auth.account_settings.errors.save')),
      );
      return null;
    } finally {
      userStore.savingPersonalization = false;
    }
  }

  return { setPersonalization };
}
