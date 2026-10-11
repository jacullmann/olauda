<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAppAuth } from '@/modules/auth/composables/useAppAuth';
import { useUserStore } from '@/stores/userStore';
import { Camera, ImagePlus, Trash2, Upload } from '@lucide/vue';
import GroupAvatarCropper from '@/modules/groups/components/GroupAvatarCropper.vue';
import GroupTypeRadioGroup from '@/modules/groups/components/GroupTypeRadioGroup.vue';
import { uploadGroupAvatar, type GroupAvatarUpload } from '@/api/files';
import Avatar from '@/modules/auth/components/Avatar.vue';
import { apiErrorMessage } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { GROUP_NAME_MAX_LENGTH, type GroupType } from '@/types/groups';

const { t } = useI18n();
const toast = useToast();

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'cancel'): void;
}>();

const router = useRouter();
const auth = useAppAuth();
const userStore = useUserStore();

const groupNameInputRef = ref<HTMLInputElement | null>(null);

const groupName = ref('');
const groupType = ref<GroupType>('regular');
const daltonEnabled = ref(false);
const submitting = ref(false);
const errorMsg = ref('');

// Avatar/Cropper state
const fileInputRef = ref<HTMLInputElement | null>(null);
const cameraInputRef = ref<HTMLInputElement | null>(null);
const cropperOpen = ref(false);
const selectedImageSrc = ref('');
const savingAvatar = ref(false);
const isMenuOpen = ref(false);
const avatar = ref<GroupAvatarUpload | null>(null);
const avatarUrl = computed(() => avatar.value?.url ?? null);

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
}

function triggerUploadAndClose() {
  isMenuOpen.value = false;
  fileInputRef.value?.click();
}

function triggerCameraCaptureAndClose() {
  isMenuOpen.value = false;
  cameraInputRef.value?.click();
}

function deleteAvatar() {
  isMenuOpen.value = false;
  avatar.value = null;
}

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    toast.error(t('groups.settings.general.avatar.errors.invalid_file'));
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    selectedImageSrc.value = event.target?.result as string;
    cropperOpen.value = true;
    input.value = '';
  };
  reader.onerror = () => {
    toast.error(t('groups.settings.general.avatar.errors.read'));
  };
  reader.readAsDataURL(file);
}

async function onCropConfirmed(blob: Blob) {
  cropperOpen.value = false;
  savingAvatar.value = true;

  try {
    avatar.value = await uploadGroupAvatar(blob);
  } catch {
    toast.error(t('groups.settings.general.avatar.errors.upload'));
  } finally {
    savingAvatar.value = false;
  }
}

const isValid = computed(() => {
  return groupName.value.trim().length > 0;
});

function clearError() {
  errorMsg.value = '';
}

onMounted(() => {
  setTimeout(() => {
    groupNameInputRef.value?.focus();
  }, 100);
});

async function submit() {
  if (!isValid.value || submitting.value) return;

  submitting.value = true;
  errorMsg.value = '';

  try {
    const res = await auth.createGroup(
      groupName.value.trim(),
      avatar.value?.id,
      groupType.value,
      daltonEnabled.value,
    );

    if (res.ok) {
      try {
        await userStore.fetchUser();
      } catch {
        // The group was created; a stale profile refreshes on next navigation.
      }

      emit('cancel');
      await router.push({
        name: 'group-dashboard',
        params: { groupId: res.groupId },
      });
    } else {
      errorMsg.value = res.error;
    }
  } catch (err: unknown) {
    errorMsg.value = apiErrorMessage(err, t('groups.errors.create'));
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    :submit="submit"
    :loading="submitting"
    :error="errorMsg"
    :cancel="undefined"
    @cancel="$emit('cancel')"
  >
    <template #title>{{ t('groups.list.create_group') }}</template>

    <template #content>
      <div class="flex flex-col items-center gap-4">
        <!-- Avatar Preview Circle -->
        <div class="relative flex-shrink-0">
          <Avatar v-if="avatarUrl" :picture="avatarUrl" :size="24"></Avatar
          ><span
            v-if="avatarUrl"
            class="absolute inset-0 hover:bg-[#8886] rounded-full z-10000 cursor-pointer touch-target transition-hover"
            @click="toggleMenu"
          ></span>

          <div
            v-if="!avatarUrl"
            class="w-24 h-24 relative rounded-full flex items-center justify-center cursor-pointer group bg-surface hover:bg-surface-highlight transition-colors overflow-hidden touch-target"
            @click="toggleMenu"
          >
            <ImagePlus
              class="text-on-ghost-muted group-hover:text-on-ghost transition-colors"
              :size="32"
            />

            <div
              v-if="savingAvatar"
              class="absolute inset-0 bg-zinc-950/70 flex items-center justify-center z-20"
            >
              <BaseSpinner />
            </div>
          </div>

          <BaseMenu
            :open="isMenuOpen"
            :title="t('groups.settings.general.avatar.title')"
            class="left-1/2 -translate-x-1/2 mt-2 z-30 min-w-45"
            @close="isMenuOpen = false"
            @click.stop
          >
            <BaseMenuButton
              :icon="Upload"
              :disabled="savingAvatar"
              @click="triggerUploadAndClose"
            >
              {{ t('groups.settings.general.avatar.actions.upload') }}
            </BaseMenuButton>

            <BaseMenuButton
              :icon="Camera"
              :disabled="savingAvatar"
              @click="triggerCameraCaptureAndClose"
            >
              {{ t('groups.settings.general.avatar.actions.capture') }}
            </BaseMenuButton>

            <BaseMenuDivider v-if="avatarUrl" />

            <BaseMenuButton
              v-if="avatarUrl"
              variant="danger"
              :icon="Trash2"
              :disabled="savingAvatar"
              @click="deleteAvatar"
            >
              {{ t('groups.settings.general.avatar.actions.delete') }}
            </BaseMenuButton>
          </BaseMenu>
        </div>
        <span class="text-xs text-on-ghost-muted">{{
          t('groups.settings.general.avatar.description') ||
          'Optionally choose a group picture'
        }}</span>
      </div>

      <BaseFormGroup id="group-name">
        <BaseLabel for="group-name">{{
          t('auth.create_group.name_label')
        }}</BaseLabel>
        <BaseInput
          id="group-name"
          ref="groupNameInputRef"
          v-model="groupName"
          :maxlength="GROUP_NAME_MAX_LENGTH"
          :placeholder="
            t('groups.settings.general.appearance.name_placeholder')
          "
          type="text"
          autocomplete="off"
          @input="clearError"
        />
      </BaseFormGroup>

      <GroupTypeRadioGroup v-model="groupType" />

      <BaseFormGroup id="group-dalton">
        <BaseLabel for="group-dalton">{{
          t('auth.create_group.settings_label')
        }}</BaseLabel>
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium" for="group-dalton">{{
            t('auth.create_group.dalton_label')
          }}</label>
          <BaseToggle
            id="group-dalton"
            v-model="daltonEnabled"
            :disabled="submitting"
          />
        </div>
      </BaseFormGroup>

      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        class="hidden"
        @change="onFileSelected"
      />

      <input
        ref="cameraInputRef"
        type="file"
        accept="image/*"
        capture="user"
        class="hidden"
        @change="onFileSelected"
      />

      <GroupAvatarCropper
        :open="cropperOpen"
        :image-src="selectedImageSrc"
        @cancel="cropperOpen = false"
        @confirm="onCropConfirmed"
      />
    </template>

    <template #action-text> {{ t('common.buttons.create') }} </template>
  </BaseModal>
</template>
