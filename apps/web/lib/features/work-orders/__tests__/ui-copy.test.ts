import { getWorkOrdersCopy } from '../ui-copy';

describe('work orders ui copy', () => {
  it('returns Turkish copy as default', () => {
    const copy = getWorkOrdersCopy();
    expect(copy.pageTitle).toBe('İş Emirleri');
    expect(copy.statusLabels.open).toBe('Açık');
  });

  it('normalizes English locale variants', () => {
    const copy = getWorkOrdersCopy('en-US');
    expect(copy.pageTitle).toBe('Work Orders');
    expect(copy.priorityLabels.critical).toBe('Critical');
  });

  it('normalizes Arabic locale variants', () => {
    const copy = getWorkOrdersCopy('ar_EG');
    expect(copy.pageTitle).toBe('أوامر العمل');
    expect(copy.statusLabels.done).toBe('مكتمل');
  });
});
