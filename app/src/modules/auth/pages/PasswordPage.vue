<script setup lang="ts">
import { computed, reactive, useTemplateRef, watchPostEffect } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useToast } from '@/common/composables/useToast';
import { useUserStore } from '@/stores/userStore';
import { useChangePassword } from '@/modules/auth/composables/useChangePassword';
import { useSetPassword } from '@/modules/auth/composables/useSetPassword';
import { entranceDelay } from '@/modules/tasks/utils/entrance';

const DESCRIPTION_ENTRANCE_ORDER = 1;
const CONTENT_ENTRANCE_ORDER = 2;
const ACTIONS_ENTRANCE_ORDER = 3;

const { t } = useI18n();
const router = useRouter();
const toast = useToast();
const userStore = useUserStore();

// Read once: setting the first password flips it, and the page must not
// swap to the change form while it is leaving.
const isChange = userStore.hasPassword;
const email = userStore.user?.email ?? '';

// Stepping back instead of pushing the origin keeps the origin's own back
// entry intact, so leaving it afterwards does not return here.
const hasOrigin = typeof router.options.history.state.back === 'string';

function leave() {
  if (hasOrigin) router.back();
  else {
    void router.replace({
      name: 'account-settings',
      params: { tab: 'security', subTab: 'password' },
    });
  }
}

function succeed(message: string) {
  toast.success(message);
  leave();
}

const changeForm = reactive(
  useChangePassword(() => succeed(t('auth.change_password.success.change'))),
);
const setForm = reactive(
  useSetPassword(() => succeed(t('auth.set_password.success.set'))),
);
const form = isChange ? changeForm : setForm;

const isRequestStep = computed(() => !isChange && setForm.step === 'request');

const title = isChange
  ? t('auth.change_password.title')
  : t('auth.set_password.title');

const description = computed(() => {
  if (isChange) return t('auth.change_password.description');
  return isRequestStep.value
    ? t('auth.set_password.request_description', { email })
    : t('auth.set_password.code_sent', { email });
});

const submitLabel = computed(() =>
  isRequestStep.value ? t('auth.set_password.send_code') : title,
);

const firstInput = useTemplateRef<{ focus: () => void }>('firstInput');
watchPostEffect(() => firstInput.value?.focus());
</script>

<template>
  <form
    novalidate
    class="flex flex-col w-full max-w-120 max-md:self-stretch"
    @submit.prevent="form.submit"
  >
    <div class="w-full mb-8">
      <h1 class="text-center! animate-enter">
        {{ title }}
      </h1>
      <!-- Keyed, so the next step's description enters like the page did. -->
      <p
        :key="description"
        class="text-center m-0! animate-enter"
        :style="{
          '--enter-delay': entranceDelay(DESCRIPTION_ENTRANCE_ORDER),
        }"
      >
        {{ description }}
      </p>
    </div>

    <BaseFormContent
      class="flex-1 animate-enter"
      :style="{ '--enter-delay': entranceDelay(CONTENT_ENTRANCE_ORDER) }"
      :error="form.error"
    >
      <BaseFormGroup
        v-if="isChange"
        id="currentPassword"
        :error="changeForm.errors.current"
      >
        <BaseLabel for="currentPassword">
          {{ t('auth.change_password.current_password') }}
        </BaseLabel>
        <BaseInput
          id="currentPassword"
          ref="firstInput"
          v-model="changeForm.currentPassword"
          type="password"
          autocomplete="current-password"
          :placeholder="t('auth.change_password.current_placeholder')"
          :aria-describedby="
            changeForm.errors.current ? 'currentPassword-error' : undefined
          "
          @input="changeForm.clearFieldError('current')"
        />
      </BaseFormGroup>

      <BaseFormGroup
        v-else-if="!isRequestStep"
        id="setPasswordCode"
        :error="setForm.errors.code"
      >
        <BaseCodeInput
          id="setPasswordCode"
          ref="firstInput"
          v-model="setForm.code"
          :aria-label="t('auth.set_password.code_label')"
          :invalid="!!setForm.errors.code"
          :aria-describedby="
            setForm.errors.code ? 'setPasswordCode-error' : undefined
          "
          @input="setForm.clearFieldError('code')"
        />
      </BaseFormGroup>

      <template v-if="!isRequestStep">
        <BaseFormGroup id="newPassword" :error="form.errors.new">
          <BaseLabel for="newPassword">
            {{ t('auth.change_password.new_password') }}
          </BaseLabel>
          <BaseInput
            id="newPassword"
            v-model="form.newPassword"
            type="password"
            autocomplete="new-password"
            :placeholder="t('auth.change_password.new_placeholder')"
            :aria-describedby="
              form.errors.new ? 'newPassword-error' : undefined
            "
            @input="form.clearFieldError('new')"
          />
        </BaseFormGroup>

        <BaseFormGroup id="newPassword2" :error="form.errors.confirm">
          <BaseLabel for="newPassword2">
            {{ t('auth.change_password.confirm_password') }}
          </BaseLabel>
          <BaseInput
            id="newPassword2"
            v-model="form.newPassword2"
            type="password"
            autocomplete="new-password"
            :placeholder="t('auth.change_password.confirm_placeholder')"
            :aria-describedby="
              form.errors.confirm ? 'newPassword2-error' : undefined
            "
            @input="form.clearFieldError('confirm')"
          />
        </BaseFormGroup>
      </template>

      <div v-if="isChange" class="flex justify-end">
        <BaseLink :to="{ name: 'forgot-password' }">
          {{ t('auth.login.forgot') }}
        </BaseLink>
      </div>
    </BaseFormContent>

    <BasePageActions
      class="mt-12 animate-enter"
      :style="{ '--enter-delay': entranceDelay(ACTIONS_ENTRANCE_ORDER) }"
    >
      <BaseButton
        type="submit"
        variant="action"
        class="w-full"
        :loading="form.submitting"
        :disabled="form.submitting"
      >
        {{ submitLabel }}
      </BaseButton>

      <template #secondary>
        <BaseButton
          type="button"
          surface
          variant="ghost"
          class="w-full"
          :disabled="form.submitting"
          @click="leave"
        >
          {{ t('common.buttons.cancel') }}
        </BaseButton>
      </template>
    </BasePageActions>
  </form>
</template>
