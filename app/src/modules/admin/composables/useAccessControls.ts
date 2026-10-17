import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { useLoadErrorToast } from '@/common/composables/useLoadErrorToast';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import type { AccessControlSwitch } from '@/modules/admin/types';
import {
  accessControlsQuery,
  adminKeys,
} from '@/modules/admin/utils/adminQueries';

const I18N_BASE = 'admin.overview.access_controls';

/**
 * The switches that pause sign-ups or shut the platform down. A
 * switch only moves once the server saved it, so the overview never shows a
 * state that is not in effect.
 */
export function useAccessControls() {
  const { t } = useI18n();
  const toast = useToast();
  const confirmModal = useConfirmModal();
  const queryClient = useQueryClient();

  const query = useQuery(accessControlsQuery());
  const controls = computed(() => query.data.value ?? null);
  const loading = computed(() => query.isFetching.value && !controls.value);

  useLoadErrorToast(query, (error) =>
    apiErrorMessage(error, t(`${I18N_BASE}.errors.load`)),
  );

  const save = useMutation({
    mutationFn: ({ name, on }: { name: AccessControlSwitch; on: boolean }) =>
      unwrap(api.PATCH('/admin/access-controls', { body: { [name]: on } })),
    onSuccess: (saved) => {
      queryClient.setQueryData(adminKeys.accessControls(), saved);
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, t(`${I18N_BASE}.errors.save`))),
  });

  const saving = computed<AccessControlSwitch | null>(() =>
    save.isPending.value ? (save.variables.value?.name ?? null) : null,
  );

  /** Shutdown locks everyone else out at once, so turning it on asks first. */
  async function setSwitch(name: AccessControlSwitch, on: boolean) {
    if (saving.value) return;

    if (name === 'shutdown' && on) {
      const confirmed = await confirmModal.ask({
        title: t(`${I18N_BASE}.shutdown_modal.title`),
        content: t(`${I18N_BASE}.shutdown_modal.content`),
        submitText: t(`${I18N_BASE}.shutdown_modal.submit`),
        danger: true,
      });
      if (!confirmed) return;
    }

    save.mutate({ name, on });
  }

  function load() {
    void query.refetch();
  }

  return { controls, loading, saving, load, setSwitch };
}
