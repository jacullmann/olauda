import type { AxiosResponse } from 'axios';

/** Entries a personalized list left out for courses the member does not attend. */
export function hiddenByCourses(response: AxiosResponse): number {
  return Number(response.headers['x-hidden-by-courses']) || 0;
}
