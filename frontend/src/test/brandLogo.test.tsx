import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrandLogo, splitLogo } from '../components/BrandLogo/BrandLogo';
import { BRAND } from '../config/brand';

describe('Brand logo', () => {
  it('puts the Sinhala part in the orange mark and the English rest beside it', () => {
    expect(splitLogo('සිංSub')).toEqual({ mark: 'සිං', word: 'Sub' });
    expect(splitLogo('සිංසබ්')).toEqual({ mark: 'සිංසබ්', word: '' });
    expect(splitLogo('Sinsub')).toEqual({ mark: '', word: 'Sinsub' });
  });

  it('is one image named after the product for screen readers', () => {
    const { container } = render(<BrandLogo />);
    expect(screen.getByRole('img', { name: BRAND.name })).toBeInTheDocument();
    expect(container.querySelector('.brand-logo-mark')).toHaveTextContent('සිං');
    expect(container.querySelector('.brand-logo-word')).toHaveTextContent('Sub');
  });
});
