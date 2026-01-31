/**
 * Language Selector Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageSelector } from '@/components/ui/LanguageSelector';

// Mock i18n
const mockChangeLanguage = jest.fn();
jest.mock('@/lib/i18n/client', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: 'tr',
    isRtl: false,
    changeLanguage: mockChangeLanguage,
  }),
}));

describe('LanguageSelector Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render dropdown variant by default', () => {
    render(<LanguageSelector />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should show current language flag', () => {
    render(<LanguageSelector showFlag={true} />);

    expect(screen.getByText('🇹🇷')).toBeInTheDocument();
  });

  it('should open dropdown on click', async () => {
    render(<LanguageSelector />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });

  it('should show all language options when open', async () => {
    render(<LanguageSelector />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Türkçe')).toBeInTheDocument();
      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText('العربية')).toBeInTheDocument();
    });
  });

  it('should call changeLanguage when selecting a language', async () => {
    render(<LanguageSelector />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      fireEvent.click(screen.getByText('English'));
    });

    expect(mockChangeLanguage).toHaveBeenCalledWith('en');
  });

  it('should render inline variant correctly', () => {
    render(<LanguageSelector variant="inline" />);

    expect(screen.getByText('Türkçe')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('العربية')).toBeInTheDocument();
  });

  it('should highlight current language in inline variant', () => {
    render(<LanguageSelector variant="inline" />);

    const turkishButton = screen.getByText('Türkçe').closest('button');
    expect(turkishButton).toHaveClass('bg-primary');
  });
});
