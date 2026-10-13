<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useToast } from '@/common/composables/useToast';
import { storeToRefs } from 'pinia';
import { useAnnouncementFormModal } from '@/modules/announcements/stores/useAnnouncementFormModal';
import { useAnnouncementListModal } from '@/modules/announcements/stores/useAnnouncementListModal';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import { useCreateGroupModal } from '@/modules/groups/stores/useCreateGroupModal';
import { useDeleteAccountModal } from '@/modules/account/stores/useDeleteAccountModal';
import { useImageViewerModal } from '@/modules/tasks/stores/useImageViewerModal';
import { useInviteModal } from '@/modules/groups/stores/useInviteModal';
import { useTodoFormModal } from '@/modules/todos/stores/useTodoFormModal';
import { useReauthModal } from '@/modules/auth/stores/useReauthModal';
import { useSearchModal } from '@/modules/search/stores/useSearchModal';
import { useTaskFormModal } from '@/modules/tasks/stores/useTaskFormModal';
import { setReauthHandler } from '@/api/reauth';
import type { Todo } from '@/modules/todos/types';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { useSession } from '@/modules/auth/composables/useSession';
import { useGroups } from '@/modules/groups/composables/useGroups';
import { useLogout } from '@/modules/auth/composables/useLogout';
import { consumeLoginReturn } from '@/modules/auth/utils/loginReturn';
import { useOAuth } from '@/modules/auth/composables/useOAuth';
import { useIsMobileViewport } from '@/common/composables/useViewport';

// Modals are split out of the entry chunk so they never delay first paint.
// The v-if ones are prefetched on mount so opening them stays instant.
const loadSearchPalette = () =>
  import('@/modules/search/components/SearchPalette.vue');

const SearchPalette = defineAsyncComponent(loadSearchPalette);
const AuthGoogleSignUpModal = defineAsyncComponent(
  () => import('@/modules/auth/components/AuthGoogleSignUpModal.vue'),
);
const TaskFormModal = defineAsyncComponent(
  () => import('@/modules/tasks/components/TaskFormModal.vue'),
);
const TodoFormModal = defineAsyncComponent(
  () => import('@/modules/todos/components/TodoFormModal.vue'),
);
const AccountDeleteModal = defineAsyncComponent(
  () => import('@/modules/account/components/AccountDeleteModal.vue'),
);
const GroupCreateModal = defineAsyncComponent(
  () => import('@/modules/groups/components/GroupCreateModal.vue'),
);
const GroupInviteModal = defineAsyncComponent(
  () => import('@/modules/groups/components/GroupInviteModal.vue'),
);
const AnnouncementFormModal = defineAsyncComponent(
  () => import('@/modules/announcements/components/AnnouncementFormModal.vue'),
);
const AnnouncementListModal = defineAsyncComponent(
  () => import('@/modules/announcements/components/AnnouncementListModal.vue'),
);
const TaskImageViewer = defineAsyncComponent(
  () => import('@/modules/tasks/components/TaskImageViewer.vue'),
);
const AuthReauthModal = defineAsyncComponent(
  () => import('@/modules/auth/components/AuthReauthModal.vue'),
);

onMounted(() => {
  void loadSearchPalette().catch(() => {});
});

const { t } = useI18n();
const router = useRouter();
const toast = useToast();

const userStore = useUserStore();
const { user } = storeToRefs(userStore);
const { checkAuthStatus } = useSession();
const { homeRoute } = useGroups();
const performLogout = useLogout();
const { showSignUpModal, closeSignUpModal } = useOAuth();
const isMobile = useIsMobileViewport();

// On phones the search grows out of the header (SearchHeaderOverlay). Its
// parts animate on their own, so the transition is told the longest one.
const searchTransition = computed(() =>
  isMobile.value
    ? { name: 'header-search', duration: { enter: 500, leave: 300 } }
    : { name: 'fade-scale' },
);

const searchModal = useSearchModal();
const taskForm = useTaskFormModal();
const todoForm = useTodoFormModal();
const announcementForm = useAnnouncementFormModal();
const announcements = useAnnouncementListModal();
const imageViewer = useImageViewerModal();
const deleteAccount = useDeleteAccountModal();
const createGroup = useCreateGroupModal();
const invite = useInviteModal();
const confirmModal = useConfirmModal();
const reauthModal = useReauthModal();

// Requests that need a recent sign-in ask the user here and are repeated
// once they confirmed.
setReauthHandler(() => reauthModal.request());
onUnmounted(() => setReauthHandler(null));

// A new entry is confirmed only when the form was opened away from the list
// that shows it; edits change what is already on screen.
function onTaskFormSuccess() {
  const payload = taskForm.payload;
  if (payload && !payload.item && !payload.local) {
    toast.success(t('tasks.success.create'));
  }
  taskForm.succeed();
}

function onPrivateTaskFormSuccess(task: Todo) {
  const payload = todoForm.payload;
  if (payload && !payload.task && !payload.local) {
    toast.success(t('tasks.private_tasks.success.create'));
  }
  todoForm.succeed(task);
}

function onAnnouncementFormSuccess() {
  if (!announcementForm.payload?.local) {
    toast.success(t('announcements.success.publish'));
  }
  announcementForm.succeed();
}

async function logout() {
  await performLogout();
}

async function onAccountDeleted() {
  await logout();
  deleteAccount.close();
}

function onAccountDeleteError(msg: string) {
  toast.error(msg);
}

// The Google dialogs open on the sign-in pages; the route guard forwards to
// a pending invite instead of the home route if there is one.
async function onAuthSuccess() {
  await checkAuthStatus();
  await userStore.fetchUser();
  await router.replace(consumeLoginReturn() ?? homeRoute.value);
}
</script>

<template>
  <AuthGoogleSignUpModal
    :open="showSignUpModal"
    @signed-up="onAuthSuccess"
    @cancel="closeSignUpModal"
  />

  <Teleport to="body">
    <Transition
      v-bind="searchTransition"
      appear
      @after-leave="searchModal.onHidden()"
    >
      <SearchPalette v-if="searchModal.isOpen" @cancel="searchModal.close()" />
    </Transition>
  </Teleport>

  <TaskFormModal
    v-if="taskForm.payload"
    :key="taskForm.key"
    :group-id="taskForm.payload.groupId"
    :local="taskForm.payload.local"
    :open="taskForm.isOpen"
    :initial-type="taskForm.payload.type"
    :prefill="taskForm.payload.prefill"
    :initial="taskForm.payload.item"
    @cancel="taskForm.close()"
    @success="onTaskFormSuccess"
  />

  <TodoFormModal
    :key="todoForm.key"
    :open="todoForm.isOpen"
    :initial="todoForm.payload?.task ?? undefined"
    @cancel="todoForm.close()"
    @success="onPrivateTaskFormSuccess"
  />

  <AnnouncementFormModal
    v-if="announcementForm.payload"
    :key="announcementForm.key"
    :group-id="announcementForm.payload.groupId"
    :local="announcementForm.payload.local"
    :open="announcementForm.isOpen"
    @cancel="announcementForm.close()"
    @success="onAnnouncementFormSuccess"
  />

  <AnnouncementListModal
    :open="announcements.isOpen"
    :origin="announcements.payload?.origin ?? null"
    @cancel="announcements.close()"
  />

  <!-- Stays mounted while closed: its open animation needs the visible prop
       to change, and its close animation still reads the images. -->
  <TaskImageViewer
    :visible="imageViewer.isOpen"
    :images="imageViewer.payload?.images ?? []"
    :initial-index="imageViewer.payload?.initialIndex ?? 0"
    :origin="imageViewer.payload?.origin"
    :menu="imageViewer.payload?.menu"
    @cancel="imageViewer.close()"
  />

  <AccountDeleteModal
    :open="deleteAccount.isOpen"
    :email="user?.email || ''"
    @cancel="deleteAccount.close()"
    @deleted="onAccountDeleted"
    @error="onAccountDeleteError"
  />

  <GroupCreateModal :open="createGroup.isOpen" @cancel="createGroup.close()" />

  <GroupInviteModal
    v-if="invite.payload"
    :open="invite.isOpen"
    :token="invite.payload.token"
    :group-id="invite.payload.groupId"
    @cancel="invite.close()"
  />

  <!-- Rendered after every other dialog, so it opens above the one whose
       action asked for it. -->
  <AuthReauthModal />

  <!-- Always lifted: the forms above mount only when opened, so they teleport
       after this dialog and would cover it at the same layer. Lifting it also
       keeps it above the image viewer, the one overlay that raises it. -->
  <BaseConfirmModal
    :open="confirmModal.isOpen"
    elevated
    :title="confirmModal.options.title"
    :submit-text="confirmModal.options.submitText"
    :danger="confirmModal.options.danger"
    @confirm="confirmModal.answer(true)"
    @cancel="confirmModal.answer(false)"
  >
    {{ confirmModal.options.content }}
  </BaseConfirmModal>
</template>
