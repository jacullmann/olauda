<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watchEffect } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ChevronLeft, Ellipsis, Paperclip, Share, Upload } from '@lucide/vue';

import { useTasks } from '@/modules/tasks/composables/useTasks';
import { useImageViewerModal } from '@/modules/tasks/stores/useImageViewerModal';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';
import { useFileDrop } from '@/modules/tasks/composables/useFileDrop';
import { taskListRoute } from '@/modules/tasks/utils/routes';
import { menuAnchor, type MenuAnchor } from '@/common/utils/menuAnchor';
import { entranceDelay } from '@/common/utils/entrance';
import type { Attachment, Task, TaskMenuAction } from '@/modules/tasks/types';

import TaskImageMenu from '@/modules/tasks/components/TaskImageMenu.vue';
import TaskDescription from '@/modules/tasks/components/TaskDescription.vue';
import TaskImageGrid from '@/modules/tasks/components/TaskImageGrid.vue';
import TaskMenu from '@/modules/tasks/components/TaskMenu.vue';
import TaskMeta from '@/modules/tasks/components/TaskMeta.vue';
import TaskNote from '@/modules/tasks/components/TaskNote.vue';

const { t } = useI18n();
const router = useRouter();
const groupId = useGroupPageId();

const {
  user,
  openedItem: item,
  openedItemError,
  retryOpenedItem,
  marksLoading,
  onMenuAction,
  toggleArchive,
  deleteItem,
  shareItem,
  canEdit,
  canDelete,
  canDeleteImage,
  canManageNotes,
  canUploadImages,
  editingNoteForId,
  noteEditContent,
  savingNote,
  startEditNote,
  cancelEditNote,
  saveNote,
  deleteNote,
  isChecked,
  toggleCheck,
  isPinned,
  isInArchive,
  imageMenu,
  closeImageMenu,
  triggerImageUpload,
  triggerImageDrop,
  triggerImageDelete,
  handleImageContextMenu,
} = useTasks();

// Checks and pins decide the controls, so the task waits for them rather
// than flipping its checkbox a moment after it appeared.
const isReady = computed(() => !!item.value && !marksLoading.value);

const hasNote = computed(
  () =>
    !!item.value &&
    (!!item.value.editorNote || editingNoteForId.value === item.value.id),
);

/** The top bar, then the task from its title down. */
const TITLE_ENTRANCE_ORDER = 1;
const NOTE_ENTRANCE_ORDER = 2;
const DESCRIPTION_ENTRANCE_ORDER = 3;
const IMAGES_ENTRANCE_ORDER = 4;

function goToList() {
  void router.push(taskListRoute(groupId));
}

/**
 * Stepping back keeps the history as it was, and the list where it was left.
 * A task opened from a link has nothing of this app behind it to step back to.
 */
function leave() {
  if (router.options.history.state.back) router.back();
  else goToList();
}

const menuPosition = ref<MenuAnchor | null>(null);

function openMenu(event: MouseEvent) {
  menuPosition.value = menuAnchor(event);
}

async function onDetailMenuAction(action: TaskMenuAction) {
  const task = item.value;
  if (!task) return;
  menuPosition.value = null;

  // Like leaving a mail for the archive or the bin: the task is done with,
  // so the page it came from takes over.
  if (action === 'archive') {
    void toggleArchive(task);
    leave();
    return;
  }
  if (action === 'delete') {
    if (await deleteItem(task.id)) leave();
    return;
  }
  await onMenuAction(action, task);
}

const imageViewerModal = useImageViewerModal();

// The viewer grows out of the tile it was opened from and shrinks back into
// it, so it has to find that tile again, also after paging to another image.
function imageTile(task: Task, index: number) {
  return document.querySelector<HTMLElement>(
    `[data-task-images="${CSS.escape(task.id)}"] [data-image-index="${index}"]`,
  );
}

function openImage(index: number) {
  const task = item.value;
  if (!task) return;
  imageViewerModal.show(
    task.attachments,
    index,
    (tileIndex) => imageTile(task, tileIndex),
    // The viewer carries no context of its own, so it is handed the same menu
    // the tiles open on a right click, bound to the image it is showing.
    (event, imageIndex) => {
      const img = task.attachments[imageIndex];
      if (img) handleImageContextMenu(event, task, img);
    },
  );
}

function openImageMenu(event: MouseEvent, img: Attachment) {
  if (item.value) handleImageContextMenu(event, item.value, img);
}

watchEffect(() => {
  if (item.value) document.title = `${item.value.title} | Olauda`;
});

// Files dropped anywhere on the task's view are attached to it.
const { isDragOver: isDroppingFiles } = useFileDrop(
  (files) => {
    if (isReady.value && item.value) triggerImageDrop(item.value, files);
  },
  { target: useTemplateRef<HTMLElement>('view'), enabled: canUploadImages },
);

onMounted(() => {
  window.scrollTo({ top: 0, behavior: 'instant' });
});
</script>

<template>
  <div ref="view" class="relative flex flex-1 flex-col p-4">
    <!-- The view fills the visible height below the header, so a short task
         still gives files the whole view to land on. It is the only root
         node, not even a comment beside it, so the page transition can swap
         its hooks when it leaves. -->
    <div class="flex w-full max-w-192 flex-1 flex-col mx-auto">
      <div class="animate-enter flex items-center justify-between gap-2 mb-6">
        <BaseTooltip :content="t('common.buttons.back')" placement="bottom">
          <BaseButton
            variant="ghost"
            :aria-label="t('common.buttons.back')"
            :icon="ChevronLeft"
            @click="leave"
          />
        </BaseTooltip>

        <BaseRow v-if="isReady && item" class="flex-nowrap!">
          <BaseButton
            v-if="canEdit(item)"
            variant="ghost"
            :aria-label="t('common.buttons.edit')"
            @click="onDetailMenuAction('edit')"
          >
            {{ t('common.buttons.edit') }}
          </BaseButton>

          <BaseTooltip
            v-else-if="canUploadImages"
            :content="t('tasks.list.tasks.menu.upload_images')"
            placement="bottom"
          >
            <BaseButton
              variant="ghost"
              :aria-label="t('tasks.list.tasks.menu.upload_images')"
              :icon="Paperclip"
              @click="onDetailMenuAction('images')"
            />
          </BaseTooltip>

          <BaseTooltip
            :content="t('tasks.list.tasks.menu.share')"
            placement="bottom"
          >
            <BaseButton
              variant="ghost"
              :aria-label="t('tasks.list.tasks.menu.share')"
              :icon="Share"
              @click="shareItem(item)"
            />
          </BaseTooltip>

          <BaseTooltip :content="t('common.more')" placement="bottom">
            <BaseButton
              variant="ghost"
              :aria-label="t('common.more')"
              :icon="Ellipsis"
              @click.stop="openMenu"
            />
          </BaseTooltip>

          <TaskMenu
            :open="menuPosition !== null"
            :anchor="menuPosition"
            :is-pinned="isPinned(item.id)"
            :is-in-archive="isInArchive(item)"
            :can-upload-images="canUploadImages"
            :can-add-note="canManageNotes && !item.editorNote"
            :can-delete="canDelete(item)"
            @action="onDetailMenuAction"
            @close="menuPosition = null"
          />
        </BaseRow>
      </div>

      <article v-if="isReady && item" class="flex flex-col gap-6">
        <header
          class="animate-enter"
          :style="{ '--enter-delay': entranceDelay(TITLE_ENTRANCE_ORDER) }"
        >
          <div class="flex items-start gap-3 mb-1">
            <BaseCheckbox
              v-if="user"
              class="mt-1.5"
              size="lg"
              :checked="isChecked(item.id)"
              @change="toggleCheck(item)"
            />
            <h2 class="min-w-0 break-words [overflow-wrap:anywhere]">
              {{ item.title }}
            </h2>
          </div>
          <TaskMeta :item="item" show-type />
        </header>

        <TaskNote
          v-if="hasNote"
          class="animate-enter"
          :style="{ '--enter-delay': entranceDelay(NOTE_ENTRANCE_ORDER) }"
          :note="item.editorNote"
          :editing="editingNoteForId === item.id"
          :saving="savingNote"
          :can-edit="canManageNotes"
          :model-value="noteEditContent"
          @update:model-value="noteEditContent = $event"
          @edit-start="startEditNote(item)"
          @edit-cancel="cancelEditNote()"
          @edit-save="saveNote(item.id)"
          @delete="deleteNote(item.id)"
        />

        <TaskDescription
          v-if="item.description"
          class="animate-enter select-text"
          :style="{
            '--enter-delay': entranceDelay(DESCRIPTION_ENTRANCE_ORDER),
          }"
          :description="item.description"
        />

        <TaskImageGrid
          v-if="item.attachments.length"
          :key="item.id"
          class="animate-enter"
          :style="{ '--enter-delay': entranceDelay(IMAGES_ENTRANCE_ORDER) }"
          :images="item.attachments"
          :item-id="item.id"
          @open-viewer="openImage"
          @context-menu="openImageMenu"
        />
      </article>

      <BaseEmptyState
        v-else-if="openedItemError"
        class="flex-1 animate-enter"
        :primary-action="goToList"
        :secondary-action="
          openedItemError === 'failed' ? retryOpenedItem : undefined
        "
      >
        {{
          openedItemError === 'not-found'
            ? t('tasks.list.tasks.view.not_found')
            : t('tasks.list.tasks.view.load_failed')
        }}
        <template #message>{{
          openedItemError === 'not-found'
            ? t('tasks.list.tasks.view.not_found_message')
            : t('tasks.list.tasks.view.load_failed_message')
        }}</template>
        <template #primary-action-label>{{
          t('tasks.list.tasks.view.all_tasks')
        }}</template>
        <template #secondary-action-label>{{
          t('common.buttons.refresh')
        }}</template>
      </BaseEmptyState>

      <div
        v-else
        class="animate-enter flex flex-col gap-3"
        :style="{ '--enter-delay': entranceDelay(TITLE_ENTRANCE_ORDER) }"
        aria-busy="true"
      >
        <BaseSkeleton width="[70%]" height="28px" />
        <BaseSkeleton width="[40%]" height="16px" class="mb-4" />
        <BaseSkeleton width="full" height="16px" />
        <BaseSkeleton width="full" height="16px" />
        <BaseSkeleton width="[60%]" height="16px" />
      </div>
    </div>

    <Transition
      enter-active-class="transition-[opacity,inset] duration-(--duration-focus) ease-(--ease-focus)"
      leave-active-class="transition-[opacity,inset] duration-(--duration-focus) ease-(--ease-focus)"
      enter-from-class="opacity-0 inset-0!"
      leave-to-class="opacity-0 inset-0!"
    >
      <!-- Grows in from the view's edges to keep clear of them. -->
      <div
        v-if="isDroppingFiles && isReady"
        aria-hidden="true"
        class="pointer-events-none absolute inset-1 z-(--z-docked) flex flex-col items-center justify-end rounded-xl outline-2 -outline-offset-2 outline-accent inset-shadow-drop-target"
      >
        <!-- Kept in sight while the task runs on below the screen. -->
        <div
          class="sticky bottom-[calc(var(--tab-bar-height)+--spacing(8))] mb-8 flex items-center gap-2 rounded-full bg-action px-4 py-2 font-semibold text-on-action shadow-input"
        >
          <Upload :size="18" />
          {{ t('tasks.list.tasks.view.drop_files') }}
        </div>
      </div>
    </Transition>

    <TaskImageMenu
      :visible="imageMenu.visible"
      :x="imageMenu.x"
      :y="imageMenu.y"
      :can-upload="canUploadImages"
      :can-delete="
        imageMenu.image && imageMenu.item
          ? canDeleteImage(imageMenu.item, imageMenu.image)
          : false
      "
      @upload="triggerImageUpload"
      @delete="triggerImageDelete"
      @cancel="closeImageMenu"
    />
  </div>
</template>
