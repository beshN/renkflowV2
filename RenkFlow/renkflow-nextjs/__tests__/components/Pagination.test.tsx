/**
 * Pagination Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from '@/components/ui/Pagination';

// Mock i18n
jest.mock('@/lib/i18n/client', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: 'tr',
    isRtl: false,
    changeLanguage: jest.fn(),
  }),
}));

describe('Pagination Component', () => {
  const defaultProps = {
    page: 1,
    totalPages: 10,
    total: 100,
    limit: 10,
    onPageChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render pagination controls', () => {
    render(<Pagination {...defaultProps} />);

    expect(screen.getByLabelText('First page')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous page')).toBeInTheDocument();
    expect(screen.getByLabelText('Next page')).toBeInTheDocument();
    expect(screen.getByLabelText('Last page')).toBeInTheDocument();
  });

  it('should display current page number', () => {
    render(<Pagination {...defaultProps} page={5} />);

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should call onPageChange when clicking next', () => {
    const onPageChange = jest.fn();
    render(<Pagination {...defaultProps} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('should call onPageChange when clicking previous', () => {
    const onPageChange = jest.fn();
    render(<Pagination {...defaultProps} page={5} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByLabelText('Previous page'));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('should disable previous on first page', () => {
    render(<Pagination {...defaultProps} page={1} />);

    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('First page')).toBeDisabled();
  });

  it('should disable next on last page', () => {
    render(<Pagination {...defaultProps} page={10} />);

    expect(screen.getByLabelText('Next page')).toBeDisabled();
    expect(screen.getByLabelText('Last page')).toBeDisabled();
  });

  it('should show summary when showSummary is true', () => {
    render(<Pagination {...defaultProps} showSummary={true} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('should call onLimitChange when limit selector changes', () => {
    const onLimitChange = jest.fn();
    render(
      <Pagination
        {...defaultProps}
        showLimitSelector={true}
        onLimitChange={onLimitChange}
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '50' } });

    expect(onLimitChange).toHaveBeenCalledWith(50);
  });

  it('should not render when totalPages is 1 and showSummary is false', () => {
    const { container } = render(
      <Pagination {...defaultProps} totalPages={1} showSummary={false} />
    );

    expect(container.firstChild).toBeNull();
  });
});
