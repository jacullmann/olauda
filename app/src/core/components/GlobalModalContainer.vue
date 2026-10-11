<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useToast } from '@/common/composables/useToast';
import { storeToRefs } from 'pinia';
import {
  useAnnouncementFormModal,
  useAnnouncementsModal,
  useConfirmModal,
  useCreateGroupModal,
  useDeleteAccountModal,
  useImageViewerModal,
  useInviteModal,
  usePrivateTaskFormModal,
  useReauthModal,
  useSearchModal,
  useTaskFormModal,
} from '@/stores/modalStore';
import { setReauthHandler } from '@/api/reauth';
import type { PrivateTask } from '@/modules/tasks/types';
import { useUserStore } from '@/stores/userStore';
import { useAppAuth } from '@/modules/auth/composables/useAppAuth';
import { useLogout } from '@/core/composables/useLogout';
import { consumeLoginReturn } from '@/modules/auth/utils/loginReturn';
import { useOAuth } from '@/modules/auth/composables/useOAuth';
import { useIsMobileViewport } from '@/common/composables/useViewport';

// Modals are split out of the entry chunk so they never delay first paint.
// The v-if ones are prefetched on mount so opening them stays instant.
const loadSearchPalette = () =>
  import('@/modules/search/components/SearchPalette.vue');

const SearchPalette = defineAsyncComponent(loadSearchPalette);
const GoogleSignUpModal = defineAsyncComponent(
  () => import('@/modules/auth/components/GoogleSignUpModal.vue'),
);
const TaskForm = defineAsyncComponent(
  () => import('@/modules/tasks/components/TaskForm.vue'),
);
const PrivateTaskForm = defineAsyncComponent(
  () => import('@/modules/tasks/components/PrivateTaskForm.vue'),
);
const DeleteAccountModal = defineAsyncComponent(
  () => import('@/modules/auth/components/DeleteAccountModal.vue'),
);
const CreateGroupModal = defineAsyncComponent(
  () => import('@/modules/auth/components/CreateGroupModal.vue'),
);
const InviteModal = defineAsyncComponent(
  () => import('@/modules/auth/components/InviteModal.vue'),
);
const AnnouncementForm = defineAsyncComponent(
  () => import('@/modules/announcements/components/AnnouncementForm.vue'),
);
const AnnouncementsModal = defineAsyncComponent(
  () => import('@/modules/announcements/components/AnnouncementsModal.vue'),
);
const ImageViewer = defineAsyncComponent(
  () => import('@/modules/tasks/components/ImageViewer.vue'),
);
const ReauthModal = defineAsyncComponent(
  () => import('@/modules/auth/components/ReauthModal.vue'),
);

onMounted(() => {
  void loadSearchPalette().catch(() => {});
});

const { t } = useI18n();
const router = useRouter();
const toast = useToast();

const userStore = useUserStore();
const { user } = storeToRefs(userStore);
const { checkAuthStatus, homeRoute } = useAppAuth();
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
const privateTaskForm = usePrivateTaskFormModal();
const announcementForm = useAnnouncementFormModal();
const announcements = useAnnouncementsModal();
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

function onPrivateTaskFormSuccess(task: PrivateTask) {
  const payload = privateTaskForm.payload;
  if (payload && !payload.task && !payload.local) {
    toast.success(t('tasks.private_tasks.success.create'));
  }
  privateTaskForm.succeed(task);
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
  <GoogleSignUpModal
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

  <TaskForm
    v-if="taskForm.payload"
    :key="taskForm.key"
    :group-id="taskForm.payload.groupId"
    :local="taskForm.payload.local"
    :open="taskForm.isOpen"
    :initial-type="taskForm.payload.type"
    :initial="taskForm.payload.item"
    @cancel="taskForm.close()"
    @success="onTaskFormSuccess"
  />

  <PrivateTaskForm
    :key="privateTaskForm.key"
    :open="privateTaskForm.isOpen"
    :initial="privateTaskForm.payload?.task ?? undefined"
    @cancel="privateTaskForm.close()"
    @success="onPrivateTaskFormSuccess"
  />

  <AnnouncementForm
    v-if="announcementForm.payload"
    :key="announcementForm.key"
    :group-id="announcementForm.payload.groupId"
    :local="announcementForm.payload.local"
    :open="announcementForm.isOpen"
    @cancel="announcementForm.close()"
    @success="onAnnouncementFormSuccess"
  />

  <AnnouncementsModal
    :open="announcements.isOpen"
    :origin="announcements.payload?.origin ?? null"
    @cancel="announcements.close()"
  />

  <!-- Stays mounted while closed: its open animation needs the visible prop
       to change, and its close animation still reads the images. -->
  <ImageViewer
    :visible="imageViewer.isOpen"
    :images="imageViewer.payload?.images ?? []"
    :initial-index="imageViewer.payload?.initialIndex ?? 0"
    :origin="imageViewer.payload?.origin"
    :menu="imageViewer.payload?.menu"
    @cancel="imageViewer.close()"
  />

  <DeleteAccountModal
    :open="deleteAccount.isOpen"
    :email="user?.email || ''"
    @cancel="deleteAccount.close()"
    @deleted="onAccountDeleted"
    @error="onAccountDeleteError"
  />

  <CreateGroupModal :open="createGroup.isOpen" @cancel="createGroup.close()" />

  <InviteModal
    v-if="invite.payload"
    :open="invite.isOpen"
    :token="invite.payload.token"
    :group-id="invite.payload.groupId"
    @cancel="invite.close()"
  />

  <!-- Rendered after every other dialog, so it opens above the one whose
       action asked for it. -->
  <ReauthModal />

  <!-- Always lifted: the forms above mount only when opened, so they teleport
       after this dialog and would cover it at the same layer. Lifting it also
       keeps it above the image viewer, the one overlay that raises it. -->
  <BaseDialog
    :open="confirmModal.isOpen"
    elevated
    :title="confirmModal.options.title"
    :submit-text="confirmModal.options.submitText"
    :danger="confirmModal.options.danger"
    @confirm="confirmModal.answer(true)"
    @cancel="confirmModal.answer(false)"
  >
    {{ confirmModal.options.content }}
  </BaseDialog>
</template>
