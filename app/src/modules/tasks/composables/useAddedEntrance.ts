import { onMounted, ref, watch, type Ref } from 'vue';
import { entranceDelay, hasSettledEntrance } from '@/common/utils/entrance';

/**
 * Entries added after mount, by their place in the batch they arrived with, so
 * each batch cascades in from its first entry. Entries present at mount arrive
 * with their surroundings and are left alone.
 *
 * The baseline is taken in onMounted rather than at setup: callers that fill
 * their list from their own onMounted hook, registered earlier, run first.
 */
export function useAddedEntrance(ids: Readonly<Ref<string[]>>) {
  const enteringOrder = ref(new Map<string, number>());
  let shownIds = new Set<string>();

  onMounted(() => {
    shownIds = new Set(ids.value);
  });

  watch(ids, (currentIds) => {
    const entering = new Map(enteringOrder.value);
    let order = 0;
    for (const id of currentIds) {
      if (!shownIds.has(id)) entering.set(id, order++);
    }
    shownIds = new Set(currentIds);
    enteringOrder.value = entering;
  });

  function isEntering(id: string) {
    return enteringOrder.value.has(id);
  }

  function entranceStyle(id: string) {
    const order = enteringOrder.value.get(id);
    return order === undefined ? {} : { '--enter-delay': entranceDelay(order) };
  }

  function handleEntranceEnd(event: AnimationEvent, id: string) {
    if (!hasSettledEntrance(event)) return;
    const entering = new Map(enteringOrder.value);
    entering.delete(id);
    enteringOrder.value = entering;
  }

  return { isEntering, entranceStyle, handleEntranceEnd };
}
