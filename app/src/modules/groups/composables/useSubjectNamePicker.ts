import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { DALTON_SUBJECT_KEY } from '@/modules/courses/types';
import { builtInSubjectKey } from '@/modules/courses/utils/subjectLabels';

export const CUSTOM_SUBJECT_OPTION = 'custom';

/**
 * Picks a subject name the way it is stored: a built-in subject by its
 * translation key, so every member reads it in their own language, anything
 * else by the typed name. A typed name that matches a built-in subject in any
 * language is stored as that subject's key instead.
 */
export function useSubjectNamePicker() {
  const i18n = useI18n();
  const { t } = i18n;

  /** A built-in key, {@link CUSTOM_SUBJECT_OPTION} or '' while nothing is picked. */
  const selection = ref('');
  const customName = ref('');

  const options = computed(() => [
    ...Object.entries(i18n.tm('common.subjects'))
      // Dalton is a pseudo-subject that only exists in the schedule.
      .filter(([key]) => key !== DALTON_SUBJECT_KEY)
      .map(([key, label]) => ({ value: key, label })),
    { value: CUSTOM_SUBJECT_OPTION, label: t('common.selection.other') },
  ]);

  const isCustom = computed(() => selection.value === CUSTOM_SUBJECT_OPTION);

  /** The name to store, or '' while the picker is incomplete. */
  const storedName = computed(() => {
    if (!isCustom.value) return selection.value;
    const typed = customName.value.trim();
    return typed ? (builtInSubjectKey(typed) ?? typed) : '';
  });

  function load(stored: string) {
    const isBuiltIn =
      stored !== DALTON_SUBJECT_KEY && builtInSubjectKey(stored) === stored;
    selection.value = isBuiltIn ? stored : CUSTOM_SUBJECT_OPTION;
    customName.value = isBuiltIn ? '' : stored;
  }

  function reset() {
    selection.value = '';
    customName.value = '';
  }

  return { selection, customName, options, isCustom, storedName, load, reset };
}
