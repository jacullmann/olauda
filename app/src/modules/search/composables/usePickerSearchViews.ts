import { computed, type Component, type ComputedRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { Filter, Languages, LayoutGrid, Moon, Sun, SunMoon } from '@lucide/vue';
import { useGroups } from '@/modules/groups/composables/useGroups';
import { usePersonalization } from '@/modules/account/composables/usePersonalization';
import { useOpenGroup } from '@/modules/groups/composables/useOpenGroup';
import { usePreferences } from '@/modules/account/composables/usePreferences';
import { isThemeMode } from '@/common/composables/useTheme';
import { isSupportedLocale } from '@/i18n';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import type { SearchMode, SearchView } from '@/modules/search/types';

interface Choice {
  id: string;
  label: string;
  icon: Component;
}

interface ChoiceView {
  title: string;
  placeholder: string;
  choices: Choice[];
  current: string;
  choose: (id: string) => unknown;
}

function choiceView({
  title,
  placeholder,
  choices,
  current,
  choose,
}: ChoiceView): SearchView {
  return {
    title,
    placeholder,
    sections: [
      {
        items: choices.map((choice) => ({
          ...choice,
          kind: 'option',
          checked: choice.id === current,
          run: () => choice.id !== current && choose(choice.id),
        })),
      },
    ],
  };
}

/** The views the full list's items open: one to pick a group or a setting from. */
export function usePickerSearchViews(): Record<
  Exclude<SearchMode, 'default'>,
  ComputedRef<SearchView>
> {
  const { t } = useI18n();
  const { activeGroupId, userGroups } = useGroups();
  const { openGroup } = useOpenGroup();
  const { currentTheme, currentLanguage, setTheme, setLanguage } =
    usePreferences();
  const { setPersonalization } = usePersonalization();
  const userStore = useUserStore();

  const group = computed<SearchView>(() => ({
    title: t('search.items.switch_group'),
    placeholder: t('search.items.switch_group'),
    sections: [
      {
        items: userGroups.value.map((userGroup) => ({
          id: userGroup.id,
          label: userGroup.name,
          kind: 'link',
          avatar: { name: userGroup.name, picture: userGroup.avatarUrl },
          run: () =>
            userGroup.id !== activeGroupId.value && openGroup(userGroup.id),
        })),
      },
    ],
  }));

  const theme = computed(() =>
    choiceView({
      title: t('auth.settings.theme.title'),
      placeholder: t('search.descriptions.change_theme'),
      choices: [
        { id: 'system', label: t('common.theme.system'), icon: SunMoon },
        { id: 'dark', label: t('common.theme.dark'), icon: Moon },
        { id: 'light', label: t('common.theme.light'), icon: Sun },
      ],
      current: currentTheme.value,
      choose: (id) => isThemeMode(id) && setTheme(id),
    }),
  );

  const language = computed(() =>
    choiceView({
      title: t('auth.settings.language.title'),
      placeholder: t('search.descriptions.change_language'),
      choices: [
        { id: 'de', label: 'Deutsch', icon: Languages },
        { id: 'en', label: 'English', icon: Languages },
      ],
      current: currentLanguage.value,
      choose: (id) => isSupportedLocale(id) && setLanguage(id),
    }),
  );

  const personalization = computed(() =>
    choiceView({
      title: t('auth.settings.personalization'),
      placeholder: t('search.descriptions.personalization'),
      choices: [
        {
          id: 'mine',
          label: t('auth.settings.personalization_options.mine'),
          icon: Filter,
        },
        {
          id: 'all',
          label: t('auth.settings.personalization_options.all'),
          icon: LayoutGrid,
        },
      ],
      current: (userStore.user?.personalized ?? true) ? 'mine' : 'all',
      choose: (id) => setPersonalization(id === 'mine'),
    }),
  );

  return { group, theme, language, personalization };
}
