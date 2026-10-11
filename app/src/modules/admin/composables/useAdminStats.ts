import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/client';
import { useToast } from '@/common/composables/useToast';
import type {
  DailyActivity,
  AdminStats,
  WeeklyRhythm,
} from '@/modules/admin/types';

// Shared across the dashboard shell (nav badge) and the overview page, so
// the stats are fetched once per visit and refreshed only after changes.
const stats = ref<AdminStats | null>(null);
const dailyActivity = ref<DailyActivity[]>([]);
const weeklyRhythm = ref<WeeklyRhythm | null>(null);
const loadingStats = ref(false);

export function useAdminStats() {
  const toast = useToast();
  const { t } = useI18n();

  async function loadStats() {
    loadingStats.value = true;
    try {
      const { data } = await api.get<AdminStats>('/admin/stats');
      stats.value = data;
    } catch {
      toast.error(t('admin.overview.errors.load'));
    } finally {
      loadingStats.value = false;
    }
  }

  async function loadDailyActivity() {
    try {
      const { data } = await api.get<DailyActivity[]>('/admin/stats/daily');
      dailyActivity.value = data;
    } catch {
      toast.error(t('admin.overview.errors.load'));
    }
  }

  async function loadWeeklyRhythm() {
    try {
      const { data } = await api.get<WeeklyRhythm>(
        '/admin/stats/weekly-rhythm',
      );
      weeklyRhythm.value = data;
    } catch {
      toast.error(t('admin.overview.errors.load'));
    }
  }

  return {
    stats,
    dailyActivity,
    weeklyRhythm,
    loadingStats,
    loadStats,
    loadDailyActivity,
    loadWeeklyRhythm,
  };
}
