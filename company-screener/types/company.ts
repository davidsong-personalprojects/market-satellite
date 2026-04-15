export type CompanyType = 'venture' | 'public';

export type FundingStage =
  | 'seed'
  | 'series-a'
  | 'series-b'
  | 'series-c'
  | 'series-d'
  | 'series-e'
  | 'series-f-plus'
  | 'public'
  | 'unicorn';

export type HiringSignal = 'rapid' | 'growing' | 'stable' | 'shrinking';
export type CultureBand = 'excellent' | 'very-good' | 'good' | 'below';
export type CompanySizeBand = 'micro' | 'small' | 'medium' | 'large' | 'enterprise';
export type ValuationTier = 'sub-100m' | '100m-500m' | '500m-1b' | '1b-10b' | '10b-plus';

export interface Company {
  id: string;
  name: string;
  type: CompanyType;
  sector: string;
  stage: FundingStage;
  hcGrowthPct: number;        // positive = growing, negative = shrinking
  valuation: number | null;   // billions USD; venture companies
  marketCap: number | null;   // billions USD; public companies
  cultureScore: number | null; // Glassdoor 0–5
  employeeCount: number;
  openRoles: number;
  techStack: string[];
  investors: string[];
  engBlogUrl: string | null;
  lastRound: string | null;   // e.g. "Series C · Jan 2023"
  location: string;
  website: string;
}

export interface FilterState {
  search: string;
  stages: FundingStage[];
  sectors: string[];
  hiringSignals: HiringSignal[];
  cultureScores: CultureBand[];
  companySizes: CompanySizeBand[];
  valuationTiers: ValuationTier[];
  locations: string[];
  techStack: string[];
}
