import { describe, expect, it } from 'vitest';
import { visibleSections } from './sections';
import type { SearchItem, SearchView } from '@/modules/search/types';

const item = (id: string, extra: Partial<SearchItem> = {}): SearchItem => ({
  id,
  label: id,
  kind: 'link',
  run: () => {},
  ...extra,
});

const view: SearchView = {
  title: 'Search',
  placeholder: '',
  resultsTitle: 'Results',
  sections: [
    {
      title: 'Pages',
      items: [
        item('tasks'),
        item('members', { parent: 'Settings', searchOnly: true }),
      ],
    },
    { title: 'Hidden', items: [item('delete', { searchOnly: true })] },
    { title: 'Actions', items: [item('task schedule', { kind: 'action' })] },
  ],
};

const ids = (sections: ReturnType<typeof visibleSections>) =>
  sections.map((section) => section.items.map(({ id }) => id));

describe('visibleSections', () => {
  it('browses without search-only items and drops sections left empty', () => {
    const sections = visibleSections(view, '  ');
    expect(sections.map(({ title }) => title)).toEqual(['Pages', 'Actions']);
    expect(ids(sections)).toEqual([['tasks'], ['task schedule']]);
  });

  it('ranks matches from every section, search-only ones included', () => {
    const sections = visibleSections(view, 'task');
    expect(sections).toHaveLength(1);
    expect(sections[0]?.title).toBe('Results');
    expect(ids(sections)).toEqual([['tasks', 'task schedule']]);
    expect(ids(visibleSections(view, 'delete'))).toEqual([['delete']]);
  });

  it('matches an item by the page it belongs to', () => {
    expect(ids(visibleSections(view, 'settings'))).toEqual([['members']]);
  });

  it('lists matches untitled in views without a results title', () => {
    const picker: SearchView = { ...view, resultsTitle: undefined };
    expect(visibleSections(picker, 'tasks')[0]?.title).toBeUndefined();
  });

  it('lists nothing when nothing matches', () => {
    expect(visibleSections(view, 'xylophone')).toEqual([]);
  });
});
