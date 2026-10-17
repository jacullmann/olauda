<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import type { TodoContentDto } from '@/api/schema';
import type { Todo } from '@/modules/todos/types';
import { apiErrorMessage } from '@/api/errors';
import { todoKeys } from '@/modules/todos/utils/todoQueries';

const props = defineProps<{
  initial?: Todo;
  open: boolean;
}>();
const emit = defineEmits<{
  (e: 'cancel'): void;
  (e: 'success', task: Todo): void;
}>();

const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 2000;

const i18n = useI18n();
const { t } = i18n;

type PlaceholderMessage = { title: string; description: string };

// Pick one title/description pair per form instance so both fields match.
const placeholders = computed<PlaceholderMessage[]>(() =>
  i18n.tm('tasks.private_tasks.form_placeholders'),
);
const placeholderIndex = Math.floor(Math.random() * placeholders.value.length);
const placeholder = computed(() => {
  const entry = placeholders.value[placeholderIndex];
  return entry
    ? { title: i18n.rt(entry.title), description: i18n.rt(entry.description) }
    : { title: '', description: '' };
});

const title = ref(props.initial?.title || '');
const description = ref(props.initial?.description || '');

const queryClient = useQueryClient();
const save = useMutation({
  mutationFn: (content: TodoContentDto) =>
    unwrap(
      props.initial
        ? api.PUT('/todos/{id}', {
            params: { path: { id: props.initial.id } },
            body: content,
          })
        : api.POST('/todos', { body: content }),
    ),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.all }),
});
const submitting = save.isPending;

const titleError = ref('');
const descriptionError = ref('');
const submitError = ref('');
const titleInputRef = ref<HTMLInputElement | null>(null);

onMounted(() => {
  titleInputRef.value?.focus();
});

async function submit() {
  titleError.value = '';
  descriptionError.value = '';
  submitError.value = '';

  if (!title.value.trim()) {
    titleError.value = t('tasks.errors.title_missing');
    return;
  }
  if (title.value.trim().length > TITLE_MAX_LENGTH) {
    titleError.value = t('tasks.errors.title_too_long', {
      max: TITLE_MAX_LENGTH,
    });
    return;
  }
  if (description.value.trim().length > DESCRIPTION_MAX_LENGTH) {
    descriptionError.value = t('tasks.errors.description_too_long', {
      max: DESCRIPTION_MAX_LENGTH,
    });
    return;
  }

  try {
    const saved = await save.mutateAsync({
      title: title.value.trim(),
      description: description.value.trim(),
    });
    emit('success', saved);
  } catch (e: unknown) {
    submitError.value = apiErrorMessage(e, t('tasks.errors.save'));
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    :loading="submitting"
    :submit="submit"
    header-actions
    @cancel="$emit('cancel')"
  >
    <template #title>
      {{
        initial
          ? t('tasks.private_tasks.form.edit_title')
          : t('tasks.private_tasks.form.new_title')
      }}
    </template>

    <template #content>
      <BaseFormContent :error="submitError">
        <BaseFormGroup id="private-task-title-input" :error="titleError">
          <BaseLabel for="private-task-title-input" required>{{
            t('tasks.list.task_form.title')
          }}</BaseLabel>
          <BaseInput
            id="private-task-title-input"
            ref="titleInputRef"
            v-model="title"
            :placeholder="placeholder.title"
            :maxlength="TITLE_MAX_LENGTH"
          />
        </BaseFormGroup>

        <BaseFormGroup
          id="private-task-description-input"
          :error="descriptionError"
        >
          <BaseLabel for="private-task-description-input" :required="false">{{
            t('tasks.list.task_form.description')
          }}</BaseLabel>
          <BaseInput
            id="private-task-description-input"
            v-model="description"
            as="textarea"
            rows="4"
            :placeholder="placeholder.description"
            :maxlength="DESCRIPTION_MAX_LENGTH"
          />
        </BaseFormGroup>
      </BaseFormContent>
    </template>

    <template #action-text>
      {{ initial ? t('common.buttons.save') : t('common.buttons.create') }}
    </template>
  </BaseModal>
</template>
