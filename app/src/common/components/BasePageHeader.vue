<script setup lang="ts"></script>
<template>
  <BaseRow justify="between" class="mb-4 flex-nowrap!">
    <BaseRow>
      <h2 v-if="$slots.default">
        <slot></slot>
      </h2>

      <slot name="info"></slot>
    </BaseRow>

    <div class="-my-2">
      <slot name="action"></slot>
    </div>
  </BaseRow>
</template>
