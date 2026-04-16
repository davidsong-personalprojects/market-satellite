import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type SizeBand = 'micro' | 'small' | 'medium' | 'large' | 'enterprise';
type ValuationTier = 'sub-100m' | '100m-500m' | '500m-1b' | '1b-10b' | '10b-plus';

function sizeToPrismaWhere(band: SizeBand): Prisma.CompanyWhereInput {
  switch (band) {
    case 'micro':      return { employeeCount: { lte: 50 } };
    case 'small':      return { employeeCount: { gt: 50, lte: 200 } };
    case 'medium':     return { employeeCount: { gt: 200, lte: 1000 } };
    case 'large':      return { employeeCount: { gt: 1000, lte: 5000 } };
    case 'enterprise': return { employeeCount: { gt: 5000 } };
  }
}

function tierToPrismaWhere(tier: ValuationTier): Prisma.CompanyWhereInput {
  switch (tier) {
    case 'sub-100m':  return { valuation: { lt: 0.1 } };
    case '100m-500m': return { valuation: { gte: 0.1, lt: 0.5 } };
    case '500m-1b':   return { valuation: { gte: 0.5, lt: 1 } };
    case '1b-10b':    return { valuation: { gte: 1, lt: 10 } };
    case '10b-plus':  return { valuation: { gte: 10 } };
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const type      = sp.get('type') ?? 'venture';
  const search    = sp.get('search') ?? '';
  const sectors   = sp.get('sectors')?.split(',').filter(Boolean) ?? [];
  const batches   = sp.get('batches')?.split(',').filter(Boolean) ?? [];
  const locations = sp.get('locations')?.split(',').filter(Boolean) ?? [];
  const VALID_SIZES = new Set<string>(['micro', 'small', 'medium', 'large', 'enterprise']);
  const VALID_TIERS = new Set<string>(['sub-100m', '100m-500m', '500m-1b', '1b-10b', '10b-plus']);
  const sizes = (sp.get('sizes')?.split(',').filter((s) => VALID_SIZES.has(s)) ?? []) as SizeBand[];
  const tiers = (sp.get('valuationTiers')?.split(',').filter((s) => VALID_TIERS.has(s)) ?? []) as ValuationTier[];
  const activeOnly = sp.get('activeOnly') === 'true';

  const andConditions: Prisma.CompanyWhereInput[] = [];
  if (sizes.length > 0) andConditions.push({ OR: sizes.map(sizeToPrismaWhere) });
  if (tiers.length > 0) andConditions.push({ OR: tiers.map(tierToPrismaWhere) });

  const where: Prisma.CompanyWhereInput = {
    type,
    ...(sectors.length > 0 && { sector: { in: sectors } }),
    ...(batches.length > 0 && { batch: { in: batches } }),
    ...(locations.length > 0 && { location: { in: locations } }),
    ...(activeOnly && { isActivelyHiring: true }),
    ...(search && { name: { contains: search, mode: 'insensitive' } }),
    ...(andConditions.length > 0 && { AND: andConditions }),
  };

  try {
    const companies = await prisma.company.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(companies);
  } catch (err) {
    console.error('[GET /api/companies]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
