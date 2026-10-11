import { defineStore } from 'pinia';
import { getCurrentScope, onScopeDispose, ref, shallowRef } from 'vue';
import i18n from '@/i18n';
import type { Task, ItemType, PrivateTask } from '@/modules/tasks/types';
import type { StoredFile } from '@/api/files';
import type { MorphOrigin } from '@/utils/morph';
import type { SearchMode } from '@/modules/search/types';

type TaskType = Exclude<ItemType, 'all'>;

/**
 * The state every app-wide modal shares. The payload outlives the close, so a
 * modal can still render it while it animates out. `key` changes on every
 * open, for modals that remount to start from a clean form.
 */
function useModalState<TPayload = void, TResult = void>() {
  const isOpen = ref(false);
  const key = ref(0);
  const payload = shallowRef<TPayload | null>(null);
  const successListeners = new Set<(result: TResult) => void>();

  function open(next: TPayload) {
    payload.value = next;
    key.value += 1;
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
  }

  function succeed(result: TResult) {
    successListeners.forEach((listener) => listener(result));
    close();
  }

  /** Unregisters with the calling component, or through the returned function. */
  function onSuccess(listener: (result: TResult) => void): () => void {
    successListeners.add(listener);
    const unregister = () => successListeners.delete(listener);
    if (getCurrentScope()) onScopeDispose(unregister);
    return unregister;
  }

  return { isOpen, key, payload, open, close, succeed, onSuccess };
}

export const useSearchModal = defineStore('search-modal', () => {
  const isOpen = ref(false);
  const mode = ref<SearchMode>('default');
  /** Unlike isOpen, stays set while the search animates closed. */
  const isVisible = ref(false);

  function open(nextMode: SearchMode = 'default') {
    mode.value = nextMode;
    isOpen.value = true;
    isVisible.value = true;
  }

  function close() {
    isOpen.value = false;
  }

  function toggle() {
    if (isOpen.value) close();
    else open();
  }

  /** A search reopened mid-animation is still visible when the old one finishes. */
  function onHidden() {
    isVisible.value = isOpen.value;
  }

  return { isOpen, mode, isVisible, open, close, toggle, onHidden };
});

export interface TaskFormOptions {
  type?: TaskType;
  /** Opened from the group's own page, which already tells the group. */
  local?: boolean;
}

interface TaskFormPayload {
  /** Fixed when the form opens, so navigating away cannot retarget it. */
  groupId: string;
  item: Task | null;
  type: TaskType;
  local: boolean;
}

export const useTaskFormModal = defineStore('task-form-modal', () => {
  const modal = useModalState<TaskFormPayload>();

  function openNew(
    groupId: string,
    { type = 'homework', local = false }: TaskFormOptions = {},
  ) {
    modal.open({ groupId, item: null, type, local });
  }

  function openEdit(groupId: string, item: Task) {
    modal.open({ groupId, item, type: item.type, local: false });
  }

  return { ...modal, openNew, openEdit };
});

export const usePrivateTaskFormModal = defineStore(
  'private-task-form-modal',
  () => {
    const modal = useModalState<
      {
        task: PrivateTask | null;
        /** Opened from the private task list, which shows the new task. */
        local: boolean;
      },
      PrivateTask
    >();

    function openNew({ local = false } = {}) {
      modal.open({ task: null, local });
    }

    function openEdit(task: PrivateTask) {
      modal.open({ task, local: true });
    }

    return { ...modal, openNew, openEdit };
  },
);

export const useAnnouncementFormModal = defineStore(
  'announcement-form-modal',
  () => {
    const modal = useModalState<{ groupId: string; local: boolean }>();

    function openFor(groupId: string, { local = false } = {}) {
      modal.open({ groupId, local });
    }

    return { ...modal, openFor };
  },
);

export const useAnnouncementsModal = defineStore('announcements-modal', () => {
  const modal = useModalState<{ origin: MorphOrigin | null }>();

  function show(origin: MorphOrigin | null = null) {
    modal.open({ origin });
  }

  return { ...modal, show };
});

interface ImageViewerPayload {
  images: StoredFile[];
  initialIndex: number;
  /**
   * Resolves the grid tile an image was opened from, so the viewer can grow
   * out of it and shrink back into it.
   */
  origin: ((index: number) => HTMLElement | null) | null;
  /**
   * Opens the context menu of the image on show. The page that owns the
   * images sets it, because the viewer only knows the picture, not what can
   * be done with it.
   */
  menu: ((event: MouseEvent, index: number) => void) | null;
}

export const useImageViewerModal = defineStore('image-viewer-modal', () => {
  const modal = useModalState<ImageViewerPayload>();

  function show(
    images: StoredFile[],
    initialIndex = 0,
    origin: ImageViewerPayload['origin'] = null,
    menu: ImageViewerPayload['menu'] = null,
  ) {
    modal.open({ images, initialIndex, origin, menu });
  }

  return { ...modal, show };
});

export const useInviteModal = defineStore('invite-modal', () =>
  useModalState<{ groupId: string; token: string }>(),
);

export const useCreateGroupModal = defineStore('create-group-modal', () =>
  useModalState(),
);

export const useDeleteAccountModal = defineStore('delete-account-modal', () =>
  useModalState(),
);

/**
 * What the confirmation dialog asks for: a way to confirm, or the second
 * factor once Google confirmed the first.
 */
export type ReauthStep = 'choose' | 'google-second-factor';

export const useReauthModal = defineStore('reauth-modal', () => {
  const isOpen = ref(false);
  const step = ref<ReauthStep>('choose');

  let pending: Promise<boolean> | null = null;
  let resolvePending: ((confirmed: boolean) => void) | null = null;

  /**
   * Resolves `true` once the user confirmed and `false` if they cancelled.
   * Requests made while the dialog is up share it, so several protected
   * calls at once ask only once.
   */
  function request(next: ReauthStep = 'choose'): Promise<boolean> {
    if (pending) return pending;
    step.value = next;
    isOpen.value = true;
    pending = new Promise((resolve) => {
      resolvePending = resolve;
    });
    return pending;
  }

  function settle(confirmed: boolean) {
    isOpen.value = false;
    resolvePending?.(confirmed);
    pending = null;
    resolvePending = null;
  }

  return { isOpen, step, request, settle };
});

export interface ConfirmOptions {
  title: string;
  content: string;
  submitText?: string;
  danger?: boolean;
}

export const useConfirmModal = defineStore('confirm-modal', () => {
  const isOpen = ref(false);
  const options = ref<Required<ConfirmOptions>>({
    title: '',
    content: '',
    submitText: i18n.global.t('common.buttons.confirm'),
    danger: false,
  });

  let resolvePending: ((confirmed: boolean) => void) | null = null;

  function ask(next: ConfirmOptions): Promise<boolean> {
    // A dialog replaced by a newer one counts as dismissed.
    resolvePending?.(false);
    options.value = {
      title: next.title,
      content: next.content,
      submitText: next.submitText ?? i18n.global.t('common.buttons.confirm'),
      danger: next.danger ?? false,
    };
    isOpen.value = true;

    return new Promise((resolve) => {
      resolvePending = resolve;
    });
  }

  function answer(confirmed: boolean) {
    isOpen.value = false;
    resolvePending?.(confirmed);
    resolvePending = null;
  }

  return { isOpen, options, ask, answer };
});
