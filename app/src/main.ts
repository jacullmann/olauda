import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import '@/assets/css/style.css';
import router from '@/router';
import { useTheme } from '@/common/composables/useTheme';
import i18n from '@/i18n';
import { loadAnalytics } from '@/shell/utils/analytics';
import VWave from 'v-wave';

const { initializeTheme } = useTheme();
initializeTheme();
const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(i18n);
app.use(VWave, {
  color: 'currentColor',
  initialOpacity: 0.12,
  finalOpacity: 0.12,
  duration: 0.2,
  // Touch surfaces already give press feedback; the ripple only adds latency there.
  disabled: window.matchMedia('(hover: none) and (pointer: coarse)').matches,
});
app.config.errorHandler = (err, instance, info) => {
  //if (import.meta.env.DEV) {
  console.error('Vue Error:', err);
  console.error('Component:', instance);
  console.error('Info:', info);
  //}
  // TODO: Integrate with Sentry or similar error reporting service for production
  // Example: Sentry.captureException(err, { contexts: { vue: { info } } });
};

app.mount('#app');
loadAnalytics();
