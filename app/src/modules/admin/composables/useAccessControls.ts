import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/client';
import { useToast } from '@/common/composables/useToast';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import type {
  AccessControls,
  AccessControlSwitch,
} from '@/modules/admin/types';

const ENDPOINT = '/admin/access-controls';
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
  const controls = ref<AccessControls | null>(null);
  const loading = ref(false);
  const saving = ref<AccessControlSwitch | null>(null);

  async function load() {
    loading.value = true;
    try {
      const { data } = await api.get<AccessControls>(ENDPOINT);
      controls.value = data;
    } catch {
      toast.error(t(`${I18N_BASE}.errors.load`));
    } finally {
      loading.value = false;
    }
  }

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

    saving.value = name;
    try {
      const { data } = await api.patch<AccessControls>(ENDPOINT, {
        [name]: on,
      });
      controls.value = data;
    } catch {
      toast.error(t(`${I18N_BASE}.errors.save`));
    } finally {
      saving.value = null;
    }
  }

  return { controls, loading, saving, load, setSwitch };
}
