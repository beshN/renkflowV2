import { act, fireEvent, render, screen } from '@testing-library/react';
import { PDFRenderer } from '@/components/features/pdf-viewer/components/PDFRenderer';
import { usePDFStore } from '@/stores/usePDFStore';
const scrollToIndex = jest.fn();
jest.mock('@tanstack/react-virtual', () => ({ useVirtualizer: () => ({ getVirtualItems: () => [0,1,2,3].map(index => ({ index, key: index, start: index*874, size: 874 })), getTotalSize: () => 3496, scrollToIndex }) }));
jest.mock('react-pdf', () => ({ pdfjs: { GlobalWorkerOptions: {} }, Document: ({ children, onLoadSuccess }: any) => <div><button onClick={() => onLoadSuccess({ numPages: 4, getMetadata: async () => ({}) })}>Load PDF</button>{children}</div>, Page: ({ pageNumber }: { pageNumber: number }) => <span>PDF page {pageNumber}</span> }));
let notify: IntersectionObserverCallback;
const OriginalObserver = global.IntersectionObserver;
beforeEach(() => {
  usePDFStore.getState().resetDocument(); usePDFStore.getState().setDocument('/navigation.pdf','navigation.pdf'); usePDFStore.getState().setViewMode('continuous');
  scrollToIndex.mockClear();
  global.IntersectionObserver = class { constructor(callback: IntersectionObserverCallback) { notify = callback; } observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
});
afterEach(() => { global.IntersectionObserver = OriginalObserver; usePDFStore.getState().resetDocument(); });
function intersect(page: number) {
  const element = document.querySelector(`[data-page="${page}"]`)!;
  act(() => notify([{ isIntersecting: true, target: element, boundingClientRect: { top: 0 }, rootBounds: { top: 0 } } as IntersectionObserverEntry], {} as IntersectionObserver));
}
it('scrolls to a toolbar/evidence request and ignores a delayed observation of the old page', async () => {
  render(<PDFRenderer />);
  fireEvent.click(screen.getByText('Load PDF'));
  await act(async () => {});
  intersect(1);
  act(() => usePDFStore.getState().setPageNumber(3));
  expect(scrollToIndex).toHaveBeenLastCalledWith(2, { align: 'start', behavior: 'auto' });
  intersect(1);
  expect(usePDFStore.getState().pageNumber).toBe(3);
  intersect(3);
  expect(usePDFStore.getState().pageNumber).toBe(3);
});
it('updates the toolbar from natural scrolling without scrolling the reader back', async () => {
  render(<PDFRenderer />);
  fireEvent.click(screen.getByText('Load PDF'));
  await act(async () => {});
  intersect(1);
  scrollToIndex.mockClear();
  intersect(4);
  expect(usePDFStore.getState().pageNumber).toBe(4);
  expect(scrollToIndex).not.toHaveBeenCalled();
});
