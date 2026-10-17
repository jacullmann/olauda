import { useI18n } from 'vue-i18n';
import { formatSubjectDisplay } from '@/modules/courses/utils/subjectLabels';

export function useAdminFormat() {
  const i18n = useI18n();
  const t = (key: string, named?: Record<string, unknown>) =>
    i18n.t(key, named ?? {});
  const te = (key: string) => i18n.te(key);

  const getTypeLabel = (type?: string | null) => {
    if (type === 'homework') return t('tasks.list.types.homework');
    if (type === 'dalton') return t('tasks.list.types.dalton');
    if (type === 'exam') return t('tasks.list.types.exam');
    return type ?? '';
  };

  const getSubjectName = (subject?: string, course?: string | null) =>
    subject ? formatSubjectDisplay(subject, course, t, te) : '';

  const fmtDate = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(i18n.locale.value, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '';

  const fmtDateTime = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleString(i18n.locale.value, {
          dateStyle: 'short',
          timeStyle: 'short',
        })
      : '';

  return { getTypeLabel, getSubjectName, fmtDate, fmtDateTime };
}
