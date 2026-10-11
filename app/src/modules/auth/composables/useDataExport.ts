import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/api';
import { isRateLimited, isReauthDeclined } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';

const DATA_EXPORT_URL = '/user/data-export';

// Mirrors the server's name; Content-Disposition is not exposed cross-origin.
function exportFileName(): string {
  return `olauda-export-${new Date().toISOString().slice(0, 10)}.zip`;
}

function saveFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Firefox starts the download after the click handler; revoking right away
  // would cancel it.
  setTimeout(() => URL.revokeObjectURL(url));
}

/** Downloads everything stored about the user (Art. 15 and 20 GDPR). */
export function useDataExport() {
  const { t } = useI18n();
  const toast = useToast();
  const exporting = ref(false);

  async function downloadDataExport() {
    if (exporting.value) return;
    exporting.value = true;
    try {
      const { data } = await api.get<Blob>(DATA_EXPORT_URL, {
        responseType: 'blob',
      });
      saveFile(data, exportFileName());
      toast.success(t('auth.account_settings.data_export.success'));
    } catch (e: unknown) {
      if (isReauthDeclined(e)) return;
      toast.error(
        isRateLimited(e)
          ? t('auth.account_settings.data_export.rate_limited')
          : t('auth.account_settings.data_export.error'),
      );
    } finally {
      exporting.value = false;
    }
  }

  return { exporting, downloadDataExport };
}
