import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { invalidatePersonalizedViews } from '@/modules/courses/utils/personalization';

const mutationKey = ['account', 'personalization'] as const;

/** Whether the member's lists show only their own courses. */
export function usePersonalization() {
  const { t } = useI18n();
  const toast = useToast();
  const userStore = useUserStore();
  const queryClient = useQueryClient();

  /** Views loaded meanwhile would still be filtered by the old setting. */
  const pendingSaves = useIsMutating({ mutationKey });
  const saving = computed(() => pendingSaves.value > 0);

  const save = useMutation({
    mutationKey,
    mutationFn: (personalized: boolean) =>
      unwrap(api.PATCH('/user/personalization', { body: { personalized } })),
    onMutate: (personalized) => {
      const previous = userStore.user?.personalized;
      userStore.updateUser({ personalized });
      return { previous };
    },
    onError: (err, _personalized, context) => {
      if (context?.previous !== undefined) {
        userStore.updateUser({ personalized: context.previous });
      }
      toast.error(apiErrorMessage(err, t('auth.account_settings.errors.save')));
    },
    onSuccess: () => invalidatePersonalizedViews(queryClient),
  });

  /** Resolves to the saved setting, or `null` when nothing was saved. */
  async function setPersonalization(value: boolean): Promise<boolean | null> {
    if (saving.value || !userStore.user) return null;
    try {
      await save.mutateAsync(value);
      return value;
    } catch {
      return null;
    }
  }

  return { saving, setPersonalization };
}
