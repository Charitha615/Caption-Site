import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PUBLIC_PAGES, seoFor } from '../seo/pages';
import { headHtml, pageTitle } from '../seo/site';
import { CONTENT_PAGES } from '../pages/Marketing/content';
import { ContentPage } from '../pages/Marketing/ContentPage';

describe('SEO data', () => {
  it('gives every public page its own title and description, of a length search results show in full', () => {
    const titles = PUBLIC_PAGES.map(pageTitle);
    const descriptions = PUBLIC_PAGES.map((p) => p.description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    for (const page of PUBLIC_PAGES) {
      expect(pageTitle(page).length, page.path).toBeLessThanOrEqual(75);
      expect(page.description.length, page.path).toBeGreaterThanOrEqual(70);
      expect(page.description.length, page.path).toBeLessThanOrEqual(170);
    }
  });

  it('links every content page from another one, so crawlers can find it', () => {
    const linked = new Set(CONTENT_PAGES.flatMap((p) => p.related));
    for (const page of CONTENT_PAGES.filter((p) => p.kind !== 'home')) expect(linked.has(page.path), page.path).toBe(true);
    for (const page of CONTENT_PAGES) {
      for (const path of page.related) expect(seoFor(path), `${page.path} → ${path}`).toBeDefined();
    }
  });

  it('writes canonical, share and structured-data tags, escaped', () => {
    const html = headHtml(seoFor('/si')!);
    expect(html).toContain('<link rel="canonical" href="https://sinsub.lk/si" data-seo>');
    expect(html).toContain('hreflang="en" href="https://sinsub.lk/"');
    expect(html).toContain('property="og:locale" content="si_LK"');
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).not.toMatch(/<\/script><script>/);
  });

  it('keeps sign-in pages out of search results', () => {
    expect(headHtml(seoFor('/login')!)).toContain('content="noindex, follow"');
    expect(seoFor('/dashboard')).toBeUndefined();
  });
});

describe('Content pages', () => {
  it('render one h1, the sections, the FAQ and links to related pages', () => {
    const page = CONTENT_PAGES.find((p) => p.path === '/guides/create-sinhala-srt-file')!;
    render(<MemoryRouter><ContentPage path={page.path} /></MemoryRouter>);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(page.h1);
    for (const s of page.sections) expect(screen.getByRole('heading', { name: s.heading })).toBeInTheDocument();
    expect(screen.getByText(page.faq![0]!.q)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /How to add Sinhala subtitles to a YouTube video/ }).length).toBeGreaterThan(0);
  });
});

describe('Sinhala pages', () => {
  const siPages = CONTENT_PAGES.filter((p) => p.lang === 'si' && p.kind !== 'home');

  it('pair every Sinhala page with its English version, both ways (hreflang)', () => {
    expect(siPages.length).toBeGreaterThanOrEqual(6);
    for (const page of [...siPages.map((p) => p.path), '/si/guides']) {
      const en = page.slice(3);
      for (const path of [page, en]) {
        const alt = seoFor(path)!.alternates!;
        expect(alt, path).toEqual([
          { lang: 'en', path: en },
          { lang: 'si', path: page },
          { lang: 'x-default', path: en },
        ]);
      }
    }
  });

  it('link only to Sinhala pages from a Sinhala page', () => {
    for (const page of CONTENT_PAGES.filter((p) => p.lang === 'si')) {
      for (const path of page.related) expect(path.startsWith('/si/'), `${page.path} → ${path}`).toBe(true);
    }
  });

  it('render a Sinhala guide with Sinhala breadcrumbs, date and a switch to the English version', () => {
    const page = CONTENT_PAGES.find((p) => p.path === '/si/guides/create-sinhala-srt-file')!;
    render(<MemoryRouter initialEntries={[page.path]}><ContentPage path={page.path} /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(page.h1);
    expect(screen.getAllByRole('link', { name: 'මාර්ගෝපදේශ' })[0]).toHaveAttribute('href', '/si/guides');
    expect(screen.getByText(/නොවැම්බර්/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/guides/create-sinhala-srt-file');
  });
});
