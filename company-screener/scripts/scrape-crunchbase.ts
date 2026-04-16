import { chromium } from 'playwright';
import { prisma } from '../lib/prisma';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseValuation(text: string): number | null {
  // Handles "$1.2B", "$500M", "$10M", etc.
  const match = text.match(/\$([0-9,.]+)\s*(B|M)?/i);
  if (!match) return null;
  const num = parseFloat(match[1].replace(/,/g, ''));
  const unit = match[2]?.toUpperCase();
  if (unit === 'B') return num;
  if (unit === 'M') return num / 1000;
  return null;
}

async function main() {
  const companies = await prisma.company.findMany({
    where: { isActivelyHiring: true },
    select: { id: true, name: true },
  });

  console.log(`Scraping Crunchbase for ${companies.length} actively-hiring companies...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  let i = 0;
  for (const { id, name } of companies) {
    const slug = toSlug(name);
    const url  = `https://www.crunchbase.com/organization/${slug}`;

    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });

      const valuationText = await page
        .locator('[data-testid="field-formatter-money"]')
        .first()
        .textContent({ timeout: 5_000 })
        .catch(() => null);

      const lastRoundText = await page
        .locator('[data-testid="funding-round-type"]')
        .first()
        .textContent({ timeout: 5_000 })
        .catch(() => null);

      const lastRoundDateText = await page
        .locator('[data-testid="funding-round-date"]')
        .first()
        .textContent({ timeout: 5_000 })
        .catch(() => null);

      const valuation = valuationText ? parseValuation(valuationText) : null;
      const lastRound =
        lastRoundText && lastRoundDateText
          ? `${lastRoundText.trim()} · ${lastRoundDateText.trim()}`
          : (lastRoundText?.trim() ?? null);

      if (valuation !== null || lastRound !== null) {
        await prisma.company.update({
          where: { id },
          data: { valuation, lastRound },
        });
      }

      await page.close();
    } catch (err) {
      // Bot detection or missing page — skip and continue
      console.warn(`  Skipped ${name}: ${(err as Error).message}`);
    }

    i++;
    if (i % 50 === 0) console.log(`  ${i}/${companies.length}`);

    // Random delay 2-3 seconds
    await sleep(2000 + Math.random() * 1000);
  }

  await browser.close();
  console.log('Done.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
