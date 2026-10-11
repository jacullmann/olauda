<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useUserStore } from '@/modules/account/stores/useUserStore';

const { user } = storeToRefs(useUserStore());
</script>

<template>
  <div v-if="user" class="flex items-center gap-6">
    <BaseAvatar :name="user.email" :size="24" />

    <div class="flex-1 min-w-0 flex flex-col gap-1">
      <h2 v-if="user.username" class="truncate">{{ user.username }}</h2>
      <span class="text-on-ghost-muted truncate">{{ user.email }}</span>
    </div>
  </div>
</template>
