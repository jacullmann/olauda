import { watch, type Ref } from 'vue';
import { useToast } from '@/common/composables/useToast';

interface LoadState {
  error: Ref<unknown>;
  /** The load failed with nothing to show for it. */
  isLoadingError: Ref<boolean>;
  isSuccess: Ref<boolean>;
}

/**
 * Tells the user once that a view stayed empty because its data failed to
 * load. Background refetches of data still on screen stay silent, and a
 * failure that persists is not repeated on every refetch, only after the
 * data loaded again in between.
 */
export function useLoadErrorToast(
  load: LoadState,
  message: (error: unknown) => string,
): void {
  const toast = useToast();
  let reported = false;

  watch(load.isSuccess, (loaded) => {
    if (loaded) reported = false;
  });
  watch(
    load.isLoadingError,
    (failed) => {
      if (!failed || reported) return;
      reported = true;
      toast.error(message(load.error.value));
    },
    { immediate: true },
  );
}
