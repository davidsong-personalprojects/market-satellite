import { prisma } from '../lib/prisma';

const APP_ID  = process.env.YC_ALGOLIA_APP_ID  ?? '45BWZJ1SGC';
const API_KEY = process.env.YC_ALGOLIA_SEARCH_KEY;

if (!API_KEY) {
  console.error('YC_ALGOLIA_SEARCH_KEY env var is not set');
  process.exit(1);
}

interface AlgoliaHit {
  objectID: string;
  name: string;
  website: string;
  one_liner?: string;
  batch?: string;
  tags?: string[];
  team_size?: string;
  city?: string;
  country?: string;
}

interface AlgoliaResult {
  results: Array<{ hits: AlgoliaHit[]; nbPages: number; page: number }>;
}

function midpoint(range: string | undefined): number {
  if (!range) return 1;
  const map: Record<string, number> = {
    '1-10': 5, '11-50': 30, '51-200': 125, '201-500': 350,
    '501-1000': 750, '1001-5000': 3000, '5001-10000': 7500, '10001+': 10000,
  };
  return map[range] ?? 1;
}

function toSector(tags: string[] | undefined): string {
  if (!tags || tags.length === 0) return 'Other';
  const knownSectors = [
    'AI / ML', 'Developer Tools', 'Fintech', 'Healthtech', 'Biotech',
    'Cybersecurity', 'Consumer', 'SaaS', 'Crypto', 'Edtech', 'Cleantech',
  ];
  const match = tags.find((t) =>
    knownSectors.some((s) =>
      t.toLowerCase().includes(s.toLowerCase().split(' / ')[0].toLowerCase())
    )
  );
  return match ?? tags[0];
}

function toLocation(city: string | undefined, country: string | undefined): string {
  if (!city && !country) return 'Remote';
  if (!city) return country!;
  return city;
}

async function fetchPage(page: number): Promise<{ hits: AlgoliaHit[]; nbPages: number }> {
  const res = await fetch(
    `https://${APP_ID.toLowerCase()}-dsn.algolia.net/1/indexes/*/queries`,
    {
      method: 'POST',
      headers: {
        'x-algolia-application-id': APP_ID,
        'x-algolia-api-key': API_KEY!,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{ indexName: 'YCCompany_production', params: `hitsPerPage=1000&page=${page}` }],
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Algolia error ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as AlgoliaResult;
  return json.results[0];
}

async function main() {
  let page = 0;
  let total = 0;

  console.log('Fetching YC companies from Algolia...');

  while (true) {
    const { hits, nbPages } = await fetchPage(page);

    const upserts = hits.map((hit) =>
      prisma.company.upsert({
        where: { id: hit.objectID },
        create: {
          id: hit.objectID,
          name: hit.name,
          website: hit.website ?? '',
          description: hit.one_liner ?? '',
          batch: hit.batch ?? 'Unknown',
          sector: toSector(hit.tags),
          location: toLocation(hit.city, hit.country),
          employeeCount: midpoint(hit.team_size),
          type: 'venture',
          openRoles: 0,
          isActivelyHiring: false,
          valuation: null,
          lastRound: null,
          hcGrowthPct: null,
        },
        update: {
          name: hit.name,
          website: hit.website ?? '',
          description: hit.one_liner ?? '',
          batch: hit.batch ?? 'Unknown',
          sector: toSector(hit.tags),
          location: toLocation(hit.city, hit.country),
          employeeCount: midpoint(hit.team_size),
        },
      })
    );

    await Promise.all(upserts);
    total += hits.length;
    console.log(`  Page ${page + 1}/${nbPages} — ${hits.length} companies (${total} total)`);

    if (page + 1 >= nbPages) break;
    page++;
  }

  console.log(`Done. Upserted ${total} companies.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
