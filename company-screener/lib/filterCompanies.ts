import type {
  Company,
  FilterState,
  HiringSignal,
  CultureBand,
  CompanySizeBand,
  ValuationTier,
} from '@/types/company';

export const EMPTY_FILTERS: FilterState = {
  search: '',
  stages: [],
  sectors: [],
  hiringSignals: [],
  cultureScores: [],
  companySizes: [],
  valuationTiers: [],
  locations: [],
  techStack: [],
};

function matchesHiringSignal(pct: number, signal: HiringSignal): boolean {
  switch (signal) {
    case 'rapid':     return pct > 25;
    case 'growing':   return pct >= 10 && pct <= 25;
    case 'stable':    return pct >= 0 && pct < 10;
    case 'shrinking': return pct < 0;
  }
}

function matchesCultureBand(score: number | null, band: CultureBand): boolean {
  if (score === null) return false;
  switch (band) {
    case 'excellent': return score >= 4.5;
    case 'very-good': return score >= 4.0 && score < 4.5;
    case 'good':      return score >= 3.5 && score < 4.0;
    case 'below':     return score < 3.5;
  }
}

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

export function filterCompanies(companies: Company[], filters: FilterState): Company[] {
  return companies.filter((c) => {
    if (filters.search && !c.name.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.stages.length > 0 && !filters.stages.includes(c.stage)) {
      return false;
    }
    if (filters.sectors.length > 0 && !filters.sectors.includes(c.sector)) {
      return false;
    }
    if (
      filters.hiringSignals.length > 0 &&
      !filters.hiringSignals.some((s) => matchesHiringSignal(c.hcGrowthPct, s))
    ) {
      return false;
    }
    if (
      filters.cultureScores.length > 0 &&
      !filters.cultureScores.some((b) => matchesCultureBand(c.cultureScore, b))
    ) {
      return false;
    }
    if (
      filters.companySizes.length > 0 &&
      !filters.companySizes.some((b) => matchesSizeBand(c.employeeCount, b))
    ) {
      return false;
    }
    if (filters.valuationTiers.length > 0) {
      const val = c.valuation ?? c.marketCap;
      if (!filters.valuationTiers.some((t) => matchesValuationTier(val, t))) {
        return false;
      }
    }
    if (filters.locations.length > 0 && !filters.locations.includes(c.location)) {
      return false;
    }
    if (
      filters.techStack.length > 0 &&
      !filters.techStack.some((t) => c.techStack.includes(t))
    ) {
      return false;
    }
    return true;
  });
}
