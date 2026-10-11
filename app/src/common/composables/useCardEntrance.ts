import { computed, ref, watch, type Ref } from 'vue';
import { useSkeletonHandoff } from './useSkeletonHandoff';
import { entranceDelay, hasSettledEntrance } from '@/common/utils/entrance';

/**
 * Cards that just appeared, by their place in the batch they arrived with, so
 * each batch cascades in from its first card, or after the cards still
 * entering. A card leaves the map once settled: moving a card in the list
 * re-inserts its node, which restarts its animations.
 *
 * While `held`, the list sits behind a skeleton and may still reorder as it
 * loads, so the order is only taken once the cards are actually shown. The
 * cards then take over the skeleton rows' places in the entrance, starting at
 * `skeletonOrder`, and continue from wherever those rows had got to.
 */
export function useCardEntrance(
  ids: Readonly<Ref<string[]>>,
  held: Readonly<Ref<boolean>>,
  skeletonOrder = 0,
) {
  const enteringOrder = ref(new Map<string, number>());
  let shownIds = new Set<string>();
  /** On the document timeline, shared by every card of the running cascade. */
  let cascadeStart: number | null = null;
  const entranceStart = useSkeletonHandoff(held);

  watch(
    [ids, held],
    ([currentIds, isHeld], [, wasHeld]) => {
      if (isHeld) return;
      const currentIdSet = new Set(currentIds);
      // A card gone before it settled never reports its end.
      const entering = new Map(
        [...enteringOrder.value].filter(([id]) => currentIdSet.has(id)),
      );
      // Cards arriving while others still cascade in queue up behind them, on
      // the same clock, so their delays line up with the cards ahead.
      if (!entering.size) {
        cascadeStart = wasHeld ? entranceStart.value : performance.now();
      }
      let order = wasHeld
        ? skeletonOrder
        : entering.size
          ? Math.max(...entering.values()) + 1
          : 0;
      for (const id of currentIds) {
        if (!shownIds.has(id)) entering.set(id, order++);
      }
      shownIds = currentIdSet;
      enteringOrder.value = entering;
    },
    { immediate: true },
  );

  const hasSettled = computed(
    () => !held.value && enteringOrder.value.size === 0,
  );

  function isEntering(id: string) {
    return enteringOrder.value.has(id);
  }

  /** For `v-entrance-start` on a card. */
  function entranceStartOf(id: string) {
    return enteringOrder.value.has(id) ? cascadeStart : null;
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

  /**
   * For cards that were already there and only come into view, like the next
   * page of a list scrolled to its end: cascading them in would read as them
   * arriving late.
   */
  function showWithoutEntrance(ids: Iterable<string>) {
    for (const id of ids) shownIds.add(id);
  }

  /** For a list put away before its cards settled, so they return in place. */
  function settleAll() {
    enteringOrder.value = new Map();
  }

  return {
    entranceStart,
    entranceStartOf,
    isEntering,
    hasSettled,
    entranceStyle,
    handleEntranceEnd,
    showWithoutEntrance,
    settleAll,
  };
}
