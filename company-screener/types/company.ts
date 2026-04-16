export type CompanyType = 'venture' | 'public';
export type CompanySizeBand = 'micro' | 'small' | 'medium' | 'large' | 'enterprise';
export type ValuationTier = 'sub-100m' | '100m-500m' | '500m-1b' | '1b-10b' | '10b-plus';

export interface Company {
  id: string;
  name: string;
  type: CompanyType;
  sector: string;
  batch: string;
  description: string;
  hcGrowthPct: number | null;
  valuation: number | null;
  employeeCount: number;
  openRoles: number;
  isActivelyHiring: boolean;
  lastRound: string | null;
  location: string;
  website: string;
}

export interface FilterState {
  search: string;
  batches: string[];
  sectors: string[];
  activeOnly: boolean;
  companySizes: CompanySizeBand[];
  valuationTiers: ValuationTier[];
  locations: string[];
}
