<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ScrollText } from '@lucide/vue';

const props = defineProps<{
  /** The log filter that scopes it to what the page is about. */
  filter: { userId: string } | { groupId: string };
}>();

const { t } = useI18n();
const router = useRouter();

function openLog() {
  void router.push({ name: 'admin-log', query: props.filter });
}
</script>

<template>
  <section class="flex flex-col items-start gap-3">
    <div>
      <h3>{{ t('admin.log.title') }}</h3>
      <p class="text-sm text-on-ghost-muted">
        {{
          t(`admin.log.scoped_hint.${'userId' in filter ? 'user' : 'group'}`)
        }}
      </p>
    </div>
    <BaseButton variant="ghost" surface :icon="ScrollText" @click="openLog">
      {{ t('admin.log.open') }}
    </BaseButton>
  </section>
</template>
