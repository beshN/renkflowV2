import { render, screen } from '@testing-library/react';
import { CuttingMock, FinanceMock, Frame, WarehouseMock, WorkspaceMock } from '@/components/site/ProductMocks';

it('labels the preview frame and every product preview as sample data', () => {
  render(<Frame label="x"><div /></Frame>);
  expect(screen.getByText('Örnek veri')).toBeInTheDocument();
  for (const Mock of [WorkspaceMock, CuttingMock, WarehouseMock, FinanceMock]) {
    const { unmount } = render(<Mock />);
    expect(screen.getAllByText('Örnek veri')).toHaveLength(2);
    unmount();
  }
});
