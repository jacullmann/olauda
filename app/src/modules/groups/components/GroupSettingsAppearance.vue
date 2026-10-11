<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGroupGeneralSettings } from '@/modules/groups/composables/useGroupGeneralSettings';
import { Pencil, Camera, Trash2, Upload } from '@lucide/vue';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import { useToast } from '@/common/composables/useToast';
import { useGroups } from '@/modules/groups/composables/useGroups';
import { uploadGroupAvatar } from '@/api/files';
import GroupAvatarCropModal from './GroupAvatarCropModal.vue';
import { GROUP_NAME_MAX_LENGTH } from '@/modules/groups/types';

const confirmModal = useConfirmModal();
const toast = useToast();
const { t } = useI18n();
const { activeGroupAvatarUrl, checkPermission } = useGroups();
const canEditSettings = computed(() => checkPermission('edit_group_profile'));

const {
  groupName,
  editingGroupName,
  newGroupName,
  savingGroupName,
  startEditGroupName,
  cancelEditGroupName,
  saveGroupName: submitGroupName,
  saveGroupAvatar,
} = useGroupGeneralSettings();

const groupNameInputRef = ref<HTMLInputElement | null>(null);

watch(
  editingGroupName,
  (editing) => {
    if (editing) groupNameInputRef.value?.focus();
  },
  { flush: 'post' },
);

// The name text doubles as the sizer for the inline input, so it mirrors the
// draft while editing and keeps showing the saved draft until the refreshed
// group name arrives, avoiding a flash of the old name.
const groupNameText = computed(() => {
  if (editingGroupName.value)
    return (
      newGroupName.value ||
      t('groups.settings.general.appearance.name_placeholder')
    );
  if (savingGroupName.value) return newGroupName.value.trim();
  return groupName.value;
});

const canSaveGroupName = computed(
  () =>
    canEditSettings.value &&
    !savingGroupName.value &&
    !!newGroupName.value.trim(),
);

function saveGroupName() {
  if (canSaveGroupName.value) void submitGroupName();
}

const fileInputRef = ref<HTMLInputElement | null>(null);
const cameraInputRef = ref<HTMLInputElement | null>(null);
const cropperOpen = ref(false);
const selectedImageSrc = ref('');
const savingAvatar = ref(false);
const isMenuOpen = ref(false);

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

function deleteAvatarAndClose() {
  isMenuOpen.value = false;
  void deleteAvatar();
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
    const upload = await uploadGroupAvatar(blob);
    await saveGroupAvatar(upload.id);
  } catch {
    toast.error(t('groups.settings.general.avatar.errors.upload'));
  } finally {
    savingAvatar.value = false;
  }
}

async function deleteAvatar() {
  const isConfirmed = await confirmModal.ask({
    title: t('groups.settings.general.avatar.delete_modal.title'),
    content: t('groups.settings.general.avatar.delete_modal.message'),
    submitText: t('common.buttons.delete'),
    danger: true,
  });

  if (!isConfirmed) return;

  savingAvatar.value = true;
  await saveGroupAvatar(null);
  savingAvatar.value = false;
}
</script>

<template>
  <div>
    <div class="flex items-center gap-6">
      <div class="relative flex-shrink-0">
        <button
          v-if="canEditSettings"
          type="button"
          class="group relative block rounded-full cursor-pointer outline-none transition-focus focus-visible:shadow-focus-ring disabled:cursor-not-allowed"
          :aria-label="t('groups.settings.general.avatar.actions.change')"
          aria-haspopup="menu"
          :aria-expanded="isMenuOpen"
          :disabled="savingAvatar"
          @click.stop="toggleMenu"
        >
          <BaseAvatar
            :name="groupName"
            :picture="activeGroupAvatarUrl"
            :size="24"
          />
          <span
            class="absolute bottom-0 right-0 flex p-2 rounded-full bg-action text-on-action ring-4 ring-canvas transition-hover group-hover:bg-action-hover group-active:bg-action-hover group-disabled:opacity-50"
            aria-hidden="true"
          >
            <Pencil :size="18" />
          </span>
        </button>

        <BaseAvatar
          v-else
          :name="groupName"
          :picture="activeGroupAvatarUrl"
          :size="24"
        />

        <div
          v-if="savingAvatar"
          class="absolute inset-0 bg-zinc-950/70 rounded-full flex items-center justify-center z-20"
        >
          <BaseSpinner />
        </div>

        <BaseMenu
          v-if="canEditSettings"
          :open="isMenuOpen"
          :title="t('groups.settings.general.avatar.title')"
          class="left-0 mt-2 z-30 min-w-45"
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

          <BaseMenuDivider v-if="activeGroupAvatarUrl" />

          <BaseMenuButton
            v-if="activeGroupAvatarUrl"
            danger
            :icon="Trash2"
            :disabled="savingAvatar"
            @click="deleteAvatarAndClose"
          >
            {{ t('groups.settings.general.avatar.actions.delete') }}
          </BaseMenuButton>
        </BaseMenu>
      </div>

      <div class="flex-1 min-w-0 flex flex-col">
        <div
          class="flex items-center gap-2 min-h-10 max-md:grid max-md:grid-cols-[repeat(2,minmax(0,auto))]"
          :class="{ 'max-md:justify-start': !editingGroupName }"
        >
          <h2
            class="relative max-w-full justify-self-start"
            :class="
              editingGroupName
                ? 'min-w-48 max-md:col-span-2 max-md:w-full'
                : 'min-w-0'
            "
          >
            <span
              class="block overflow-hidden text-ellipsis whitespace-pre"
              :class="{ invisible: editingGroupName }"
              :aria-hidden="editingGroupName"
              >{{ groupNameText }}</span
            >
            <input
              v-if="editingGroupName"
              id="group-name"
              ref="groupNameInputRef"
              v-model="newGroupName"
              class="peer absolute inset-0 w-full p-0 bg-transparent border-0 outline-none placeholder:text-on-ghost-subtle"
              autocomplete="off"
              :maxlength="GROUP_NAME_MAX_LENGTH"
              :placeholder="
                t('groups.settings.general.appearance.name_placeholder')
              "
              :readonly="savingGroupName"
              @keydown.enter.prevent="saveGroupName"
              @keydown.esc.stop="cancelEditGroupName"
            />
            <Transition enter-from-class="scale-x-0" leave-to-class="scale-x-0">
              <span
                v-if="editingGroupName"
                class="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full origin-left bg-ghost-border peer-focus:bg-focus transition-[scale,background-color] duration-(--duration-focus) ease-(--ease-settle)"
                aria-hidden="true"
              />
            </Transition>
          </h2>

          <Transition
            v-if="canEditSettings"
            mode="out-in"
            enter-active-class="transition-[opacity,scale] duration-(--duration-focus) ease-(--ease-settle)"
            enter-from-class="opacity-0 scale-90"
            leave-active-class="transition-[opacity,scale] duration-(--duration-hover) ease-(--ease-focus)"
            leave-to-class="opacity-0 scale-90"
          >
            <BaseTooltip
              v-if="!editingGroupName"
              :content="t('common.buttons.edit')"
            >
              <BaseButton
                variant="ghost"
                :icon="Pencil"
                :aria-label="t('common.buttons.edit')"
                @click="startEditGroupName"
              />
            </BaseTooltip>

            <BaseRow
              v-else
              justify="end"
              class="shrink-0 flex-nowrap max-md:col-span-2"
            >
              <BaseButton variant="ghost" @click="cancelEditGroupName">{{
                t('common.buttons.cancel')
              }}</BaseButton>
              <BaseButton
                :disabled="!canSaveGroupName"
                variant="action"
                @click="saveGroupName"
              >
                {{
                  savingGroupName
                    ? t('common.buttons.saving')
                    : t('common.buttons.save')
                }}
              </BaseButton>
            </BaseRow>
          </Transition>
        </div>
      </div>
    </div>

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

    <GroupAvatarCropModal
      :open="cropperOpen"
      :image-src="selectedImageSrc"
      @cancel="cropperOpen = false"
      @confirm="onCropConfirmed"
    />
  </div>
</template>
