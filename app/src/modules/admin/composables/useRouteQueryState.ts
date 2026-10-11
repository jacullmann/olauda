import { computed, ref, watch } from 'vue';
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router';
import { watchDebounced } from '@vueuse/core';

const SEARCH_DEBOUNCE_MS = 300;

type QueryParams = Record<string, string>;

/** The values a parameter accepts: a fixed set, or a test for free input. */
export type QueryParamRule<T extends string> =
  readonly T[] | ((raw: string) => boolean);

export interface RouteQueryStateOptions<TParams extends QueryParams> {
  /** Every parameter with its default; a value equal to its default stays out of the URL. */
  defaults: TParams;
  /** Anything a rule rejects falls back to the default, so a hand-edited URL never reaches the server. */
  rules?: { [K in keyof TParams]?: QueryParamRule<TParams[K]> };
}

function accepts<T extends string>(
  rule: QueryParamRule<T> | undefined,
  raw: string,
): raw is T {
  if (!rule) return true;
  return typeof rule === 'function' ? rule(raw) : rule.some((v) => v === raw);
}

/**
 * A page's filters, kept in the URL query of the route it was created on, so
 * every view can be linked, reloaded and stepped through with the history.
 */
export function useRouteQueryState<TParams extends QueryParams>(
  options: RouteQueryStateOptions<TParams>,
) {
  const route = useRoute();
  const router = useRouter();
  const routeName = route.name;
  const keys = Object.keys(options.defaults) as (keyof TParams & string)[];

  function parse(): TParams {
    const result = { ...options.defaults };
    for (const key of keys) {
      const raw = route.query[key];
      if (typeof raw === 'string' && accepts(options.rules?.[key], raw)) {
        result[key] = raw;
      }
    }
    return result;
  }

  // While another route shows, such as a detail page in front of a kept-alive
  // list, the state stays as it was instead of reading a query not its own.
  // An unchanged state keeps its identity, so nothing depending on it reruns.
  const params = computed<TParams>((previous) => {
    if (previous && route.name !== routeName) return previous;
    const next = parse();
    return previous && keys.every((key) => previous[key] === next[key])
      ? previous
      : next;
  });

  const isDefault = (key: keyof TParams) =>
    params.value[key] === options.defaults[key];

  function setParams(patch: Partial<TParams>, replace = false) {
    const next = { ...params.value, ...patch };
    const query: LocationQueryRaw = {};
    for (const key of keys) {
      if (next[key] !== options.defaults[key]) query[key] = next[key];
    }
    const location = {
      name: routeName ?? undefined,
      params: route.params,
      query,
    };
    return replace ? router.replace(location) : router.push(location);
  }

  return { params, isDefault, setParams };
}

/**
 * The text of a search field, applied to the URL once typing pauses. A search
 * changed from elsewhere, such as by stepping back, is taken into the field.
 */
export function useSearchInput(
  applied: () => string,
  apply: (search: string) => unknown,
) {
  const input = ref(applied());

  watch(applied, (search) => {
    if (input.value.trim() !== search) input.value = search;
  });

  watchDebounced(
    input,
    (value) => {
      const search = value.trim();
      if (search !== applied()) void apply(search);
    },
    { debounce: SEARCH_DEBOUNCE_MS },
  );

  return input;
}
