import type {
  Company,
  FilterState,
  CompanyType,
  CompanySizeBand,
  ValuationTier,
} from '@/types/company';

export const EMPTY_FILTERS: FilterState = {
  search: '',
  batches: [],
  sectors: [],
  activeOnly: false,
  companySizes: [],
  valuationTiers: [],
  locations: [],
};

function matchesSizeBand(count: number, band: CompanySizeBand): boolean {
  switch (band) {
    case 'micro':      return count <= 50;
    case 'small':      return count > 50 && count <= 200;
    case 'medium':     return count > 200 && count <= 1000;
    case 'large':      return count > 1000 && count <= 5000;
    case 'enterprise': return count > 5000;
  }
}

function matchesValuationTier(val: number | null, tier: ValuationTier): boolean {
  if (val === null) return false;
  switch (tier) {
    case 'sub-100m':  return val < 0.1;
    case '100m-500m': return val >= 0.1 && val < 0.5;
    case '500m-1b':   return val >= 0.5 && val < 1;
    case '1b-10b':    return val >= 1 && val < 10;
    case '10b-plus':  return val >= 10;
  }
}

// Retained for unit tests. Not called at runtime — filtering runs server-side via Prisma.
export function filterCompanies(companies: Company[], filters: FilterState): Company[] {
  return companies.filter((c) => {
    if (filters.search && !c.name.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.batches.length > 0 && !filters.batches.includes(c.batch)) {
      return false;
    }
    if (filters.sectors.length > 0 && !filters.sectors.includes(c.sector)) {
      return false;
    }
    if (filters.activeOnly && !c.isActivelyHiring) {
      return false;
    }
    if (
      filters.companySizes.length > 0 &&
      !filters.companySizes.some((b) => matchesSizeBand(c.employeeCount, b))
    ) {
      return false;
    }
    if (
      filters.valuationTiers.length > 0 &&
      !filters.valuationTiers.some((t) => matchesValuationTier(c.valuation, t))
    ) {
      return false;
    }
    if (filters.locations.length > 0 && !filters.locations.includes(c.location)) {
      return false;
    }
    return true;
  });
}

export function buildQueryString(type: CompanyType, filters: FilterState): string {
  const params = new URLSearchParams();
  params.set('type', type);
  if (filters.search) params.set('search', filters.search);
  if (filters.batches.length > 0) params.set('batches', filters.batches.join(','));
  if (filters.sectors.length > 0) params.set('sectors', filters.sectors.join(','));
  if (filters.locations.length > 0) params.set('locations', filters.locations.join(','));
  if (filters.companySizes.length > 0) params.set('sizes', filters.companySizes.join(','));
  if (filters.valuationTiers.length > 0) params.set('valuationTiers', filters.valuationTiers.join(','));
  if (filters.activeOnly) params.set('activeOnly', 'true');
  return params.toString();
}
