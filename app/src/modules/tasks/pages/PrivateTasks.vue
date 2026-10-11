<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useUserStore } from '@/stores/userStore';
import PrivateTaskApp from '@/modules/tasks/components/PrivateTaskApp.vue';
import { Plus } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { usePrivateTaskFormModal } from '@/stores/modalStore';
import InfoModal from '@/common/components/InfoModal.vue';

const i18n = useI18n();
const t = i18n.t.bind(i18n);
const tm = i18n.tm.bind(i18n);

const privateTaskFormModal = usePrivateTaskFormModal();

const userStore = useUserStore();
const { user } = storeToRefs(userStore);
</script>

<template>
  <div class="flex flex-1 flex-col p-4">
    <div class="animate-enter">
      <PageHeader>
        <template #info>
          <InfoModal
            :tooltip="t('tasks.private_tasks.infopop.tooltip')"
            :title="t('tasks.private_tasks.title')"
          >
            <!-- eslint-disable-next-line vue/no-v-html -- bundled translation markup, not user input -->
            <p v-html="t('tasks.private_tasks.infopop.description')"></p>
            <template
              v-for="(section, index) in tm(
                'tasks.private_tasks.infopop.sections',
              )"
              :key="index"
            >
              <!-- eslint-disable-next-line vue/no-v-html -- bundled translation markup, not user input -->
              <h3 v-html="section.title"></h3>
              <!-- eslint-disable-next-line vue/no-v-html -- bundled translation markup, not user input -->
              <p v-html="section.text"></p>
            </template>
          </InfoModal>
        </template>
        <template #action>
          <BaseTooltip
            :content="t('tasks.private_tasks.new_task')"
            placement="bottom"
          >
            <BaseButton
              v-if="user"
              variant="action"
              :icon="Plus"
              icon-classes="size-6"
              @click="privateTaskFormModal.openNew({ local: true })"
            />
          </BaseTooltip>
        </template>
      </PageHeader>
    </div>

    <PrivateTaskApp class="flex-1" />
  </div>
</template>
