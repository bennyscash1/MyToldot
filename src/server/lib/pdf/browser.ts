import 'server-only';

import type { Browser } from 'puppeteer-core';

const SERVERLESS =
  process.env.VERCEL === '1' || Boolean(process.env.AWS_LAMBDA_FUNCTION_VERSION);

/** Launch headless Chromium — Sparticuz on Vercel, full puppeteer locally. */
export async function launchPosterBrowser(): Promise<Browser> {
  if (SERVERLESS) {
    const chromium = (await import('@sparticuz/chromium')).default;
    const puppeteer = await import('puppeteer-core');
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  try {
    const puppeteer = await import('puppeteer');
    return puppeteer.launch({ headless: true });
  } catch {
    const puppeteer = await import('puppeteer-core');
    return puppeteer.launch({ channel: 'chrome', headless: true });
  }
}
