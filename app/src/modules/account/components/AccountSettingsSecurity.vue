<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { KeyRound, Link2, MonitorSmartphone, ShieldCheck } from '@lucide/vue';
import AccountSettingsSecurityMfa from './AccountSettingsSecurityMfa.vue';
import AccountSettingsSecurityConnections from './AccountSettingsSecurityConnections.vue';
import AccountSettingsSecuritySessions from './AccountSettingsSecuritySessions.vue';
import AccountSettingsSecurityPassword from './AccountSettingsSecurityPassword.vue';
import AccountSettingsSecurityPasskeys from './AccountSettingsSecurityPasskeys.vue';
import { passkeyIcon } from '@/modules/auth/utils/passkeyIcon';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const subTab = computed(() => route.params.subTab as string | undefined);

function openSubTab(id: string) {
  void router.push({
    name: 'account-settings',
    params: { tab: 'security', subTab: id },
  });
}
</script>

<template>
  <div v-if="!subTab" class="flex flex-col max-w-200 mx-auto max-md:-mx-6">
    <BaseList @click="openSubTab('password')">
      <template #icon>
        <KeyRound :size="20" :stroke-width="1.8" />
      </template>
      <template #label>
        {{ t('auth.security.password') }}
      </template>
    </BaseList>

    <BaseList @click="openSubTab('passkeys')">
      <template #icon>
        <component :is="passkeyIcon" :size="20" :stroke-width="1.8" />
      </template>
      <template #label>
        {{ t('auth.passkeys.title') }}
      </template>
    </BaseList>

    <BaseList @click="openSubTab('two-factor')">
      <template #icon>
        <ShieldCheck :size="20" :stroke-width="1.8" />
      </template>
      <template #label>
        {{ t('auth.security.2fa') }}
      </template>
    </BaseList>

    <BaseList @click="openSubTab('connected-accounts')">
      <template #icon>
        <Link2 :size="20" :stroke-width="1.8" />
      </template>
      <template #label>
        {{ t('auth.account_settings.connected_accounts.title') }}
      </template>
    </BaseList>

    <BaseList :separator="false" @click="openSubTab('sessions')">
      <template #icon>
        <MonitorSmartphone :size="20" :stroke-width="1.8" />
      </template>
      <template #label>
        {{ t('auth.sessions.title') }}
      </template>
    </BaseList>
  </div>

  <section v-else-if="subTab === 'password'" class="max-w-160">
    <AccountSettingsSecurityPassword />
  </section>

  <section v-else-if="subTab === 'passkeys'" class="max-w-160">
    <AccountSettingsSecurityPasskeys />
  </section>

  <section v-else-if="subTab === 'two-factor'" class="max-w-160">
    <AccountSettingsSecurityMfa />
  </section>

  <section
    v-else-if="subTab === 'connected-accounts'"
    class="flex flex-col gap-2 max-w-160"
  >
    <p class="text-sm/relaxed text-on-ghost-muted m-0!">
      {{ t('auth.account_settings.connected_accounts.description') }}
    </p>
    <AccountSettingsSecurityConnections />
  </section>

  <section v-else-if="subTab === 'sessions'" class="max-w-160">
    <AccountSettingsSecuritySessions />
  </section>
</template>
