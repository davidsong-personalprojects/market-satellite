import { prisma } from '../lib/prisma';

const DELAY_MS = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeGet(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CompanyScreener/1.0)' },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function countGreenhouse(company: string): Promise<number> {
  const html = await safeGet(
    `https://boards.greenhouse.io/embed/job_board?for=${company}`
  );
  if (!html) return 0;
  return (html.match(/<div class="opening"/g) ?? []).length;
}

async function countLever(company: string): Promise<number> {
  try {
    const res = await fetch(`https://api.lever.co/v0/postings/${company}?mode=json`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as unknown[];
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

async function getOpenRoles(website: string): Promise<number> {
  const base = website.replace(/\/$/, '');

  // Check homepage for ATS embed patterns
  const homepage = await safeGet(base);
  if (homepage) {
    const ghMatch = homepage.match(/boards\.greenhouse\.io\/([a-z0-9_-]+)/i);
    if (ghMatch) return countGreenhouse(ghMatch[1]);

    const leverMatch = homepage.match(/jobs\.lever\.co\/([a-z0-9_-]+)/i);
    if (leverMatch) return countLever(leverMatch[1]);
  }

  // Fall back to /careers and /jobs pages
  for (const suffix of ['/careers', '/jobs']) {
    const html = await safeGet(`${base}${suffix}`);
    if (!html) continue;

    const ghMatch = html.match(/boards\.greenhouse\.io\/([a-z0-9_-]+)/i);
    if (ghMatch) return countGreenhouse(ghMatch[1]);

    const leverMatch = html.match(/jobs\.lever\.co\/([a-z0-9_-]+)/i);
    if (leverMatch) return countLever(leverMatch[1]);

    // Page exists with meaningful content
    if (html.length > 2000) return 1;
  }

  return 0;
}

async function main() {
  const companies = await prisma.company.findMany({
    select: { id: true, website: true },
  });
  console.log(`Checking careers pages for ${companies.length} companies...`);

  let i = 0;
  for (const { id, website } of companies) {
    if (!website) {
      i++;
      continue;
    }

    const openRoles = await getOpenRoles(website);
    const isActivelyHiring = openRoles > 0;

    await prisma.company.update({
      where: { id },
      data: { openRoles, isActivelyHiring },
    });

    await prisma.companySnapshot.create({
      data: { companyId: id, openRoles },
    });

    i++;
    if (i % 50 === 0) {
      console.log(`  ${i}/${companies.length} (latest: ${website} → ${openRoles} roles)`);
    }
    await sleep(DELAY_MS);
  }

  // Compute hcGrowthPct from two most recent snapshots per company
  console.log('Computing hcGrowthPct...');
  for (const { id } of companies) {
    const snapshots = await prisma.companySnapshot.findMany({
      where: { companyId: id },
      orderBy: { scrapedAt: 'desc' },
      take: 2,
    });

    if (snapshots.length < 2) continue;
    const [current, previous] = snapshots;
    if (previous.openRoles === 0) continue;

    const hcGrowthPct =
      ((current.openRoles - previous.openRoles) / previous.openRoles) * 100;

    await prisma.company.update({
      where: { id },
      data: { hcGrowthPct: Math.round(hcGrowthPct * 10) / 10 },
    });
  }

  console.log('Done.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
