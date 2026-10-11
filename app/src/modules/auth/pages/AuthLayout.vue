<script setup lang="ts">
import AppLogo from '@/shell/components/AppLogo.vue';
import AppLegalLinks from '@/shell/components/AppLegalLinks.vue';
</script>

<template>
  <div class="flex min-h-screen w-full flex-col bg-canvas">
    <header class="w-full px-6 py-2">
      <div class="flex items-center justify-center gap-3 text-2xl font-bold">
        <AppLogo aria-hidden="true" />
        Olauda
        <!-- TODO: implement theme and language switch -->
      </div>
    </header>
    <main class="flex flex-1 items-center justify-center py-4 px-6">
      <router-view />
    </main>
    <footer class="px-6 pt-2 pb-6">
      <AppLegalLinks />
    </footer>
  </div>
</template>
