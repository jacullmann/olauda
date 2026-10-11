<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { getAvatarData } from '@/common/utils/avatarColor';

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    name?: string;
    picture?: string | null;
    size?: number;
  }>(),
  {
    size: 8,
  },
);

const generated = computed(() => getAvatarData(props.name ?? ''));

const avatarStyle = computed(() => {
  const px = props.size * 4;
  return {
    width: `${px}px`,
    height: `${px}px`,
  };
});

const generatedStyle = computed(() => {
  const px = props.size * 4;
  return {
    ...avatarStyle.value,
    fontSize: `${(px / 5) * 3}px`,
    background: generated.value.background,
  };
});
</script>

<template>
  <div
    class="flex items-center justify-center overflow-hidden shrink-0"
    :style="avatarStyle"
  >
    <img
      v-if="picture"
      :src="picture"
      :alt="t('common.avatar.alt')"
      class="w-full h-full object-cover rounded-full"
    />

    <div
      v-else
      class="flex items-center justify-center font-bold text-white select-none rounded-full shrink-0"
      :style="generatedStyle"
    >
      {{ generated.letter }}
    </div>
  </div>
</template>
