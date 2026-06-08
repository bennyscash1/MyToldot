import 'server-only';

import { launchPosterBrowser } from './browser';
import { getPdfRenderSecret } from './pdf-render-auth';
import type { GenerateTreePdfArgs } from './types';

/**
 * Delivery-agnostic PDF renderer. Navigates the internal /print route and
 * returns raw PDF bytes. Knows nothing about HTTP or Storage.
 */
export async function generateTreePdf(args: GenerateTreePdfArgs): Promise<Buffer> {
  const planEncoded = encodeURIComponent(
    Buffer.from(JSON.stringify(args.plan)).toString('base64'),
  );
  const styleEncoded = encodeURIComponent(args.styleId);
  const renderSecret = getPdfRenderSecret();
  const tokenParam = renderSecret
    ? `&renderToken=${encodeURIComponent(renderSecret)}`
    : '';
  const url = `${args.baseUrl}/${args.locale}/tree/${args.shortCode}/print?styleId=${styleEncoded}&plan=${planEncoded}${tokenParam}`;

  const browser = await launchPosterBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 1414, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 90_000 });

    await page.evaluate((locale) => {
      const root = document.getElementById('pdf-root');
      if (!root) return;
      const dir = root.getAttribute('dir') ?? (locale === 'he' ? 'rtl' : 'ltr');
      const lang = locale === 'he' ? 'he' : 'en';
      document.documentElement.setAttribute('dir', dir);
      document.documentElement.setAttribute('lang', lang);
      document.body.innerHTML = '';
      document.body.setAttribute('dir', dir);
      document.body.appendChild(root);
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.background = 'transparent';
    }, args.locale);

    await page.waitForFunction(
      () => document.documentElement.getAttribute('data-pdf-ready') === 'true',
      { timeout: 60_000 },
    );

    const height = await page.evaluate(() => {
      const root = document.getElementById('pdf-root');
      return root ? Math.ceil(root.getBoundingClientRect().height) : 1414;
    });

    const pdf = await page.pdf({
      printBackground: true,
      width: '1000px',
      height: `${height}px`,
      pageRanges: '1',
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
