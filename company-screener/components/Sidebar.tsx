'use client';

import { FilterAccordion } from '@/components/ui/FilterAccordion';
import { EMPTY_FILTERS } from '@/lib/filterCompanies';
import type {
  FilterState,
  FundingStage,
  HiringSignal,
  CultureBand,
  CompanySizeBand,
  ValuationTier,
} from '@/types/company';

interface SidebarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

const STAGE_OPTIONS: { value: FundingStage; label: string }[] = [
  { value: 'seed',         label: 'Seed / Pre-Seed' },
  { value: 'series-a',    label: 'Series A' },
  { value: 'series-b',    label: 'Series B' },
  { value: 'series-c',    label: 'Series C' },
  { value: 'series-d',    label: 'Series D' },
  { value: 'series-e',    label: 'Series E' },
  { value: 'series-f-plus', label: 'Series F+' },
  { value: 'public',      label: 'Public (IPO / SPAC)' },
  { value: 'unicorn',     label: 'Unicorn ($1B+)' },
];

const SECTOR_OPTIONS = [
  'AI / ML', 'Developer Tools', 'Cybersecurity', 'Cloud Infra', 'Data / Analytics',
  'SaaS / Enterprise', 'Fintech', 'Crypto / Web3', 'Insurtech', 'Healthtech',
  'Biotech / Pharma', 'Cleantech / Climate', 'Defense / Aerospace', 'Edtech',
  'Proptech / Real Estate', 'Logistics / Supply Chain', 'Consumer / E-commerce',
  'Media / Creator Economy', 'Legal / Legaltech', 'HR / Future of Work',
].map((s) => ({ value: s, label: s }));

const HIRING_OPTIONS: { value: HiringSignal; label: string }[] = [
  { value: 'rapid',     label: 'Rapid growth (>25%)' },
  { value: 'growing',   label: 'Growing (10–25%)' },
  { value: 'stable',    label: 'Stable (0–10%)' },
  { value: 'shrinking', label: 'Shrinking (<0%)' },
];

const CULTURE_OPTIONS: { value: CultureBand; label: string }[] = [
  { value: 'excellent', label: '4.5 – 5.0 ★  (Excellent)' },
  { value: 'very-good', label: '4.0 – 4.4 ★  (Very Good)' },
  { value: 'good',      label: '3.5 – 3.9 ★  (Good)' },
  { value: 'below',     label: 'Below 3.5 ★' },
];

const SIZE_OPTIONS: { value: CompanySizeBand; label: string }[] = [
  { value: 'micro',      label: '1 – 50 employees' },
  { value: 'small',      label: '51 – 200 employees' },
  { value: 'medium',     label: '201 – 1,000 employees' },
  { value: 'large',      label: '1,001 – 5,000 employees' },
  { value: 'enterprise', label: '5,000+ employees' },
];

const VALUATION_OPTIONS: { value: ValuationTier; label: string }[] = [
  { value: 'sub-100m',  label: 'Under $100M' },
  { value: '100m-500m', label: '$100M – $500M' },
  { value: '500m-1b',   label: '$500M – $1B' },
  { value: '1b-10b',    label: '$1B – $10B (Unicorn)' },
  { value: '10b-plus',  label: '$10B+ (Decacorn)' },
];

const LOCATION_OPTIONS = [
  'San Francisco Bay Area', 'New York City', 'Los Angeles', 'Seattle',
  'Austin', 'Boston', 'London', 'Remote-first', 'Hybrid',
].map((l) => ({ value: l, label: l }));

const TECH_OPTIONS = [
  'Python', 'TypeScript', 'Go', 'Rust', 'Java', 'Kotlin', 'C++', 'Ruby',
  'AWS', 'GCP', 'Azure', 'Kubernetes',
].map((t) => ({ value: t, label: t }));

const activeCount = (filters: FilterState): number =>
  filters.stages.length +
  filters.sectors.length +
  filters.hiringSignals.length +
  filters.cultureScores.length +
  filters.companySizes.length +
  filters.valuationTiers.length +
  filters.locations.length +
  filters.techStack.length;

export function Sidebar({ filters, onChange }: SidebarProps) {
  const count = activeCount(filters);

  return (
    <aside className="w-52 shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-widest text-gray-800 uppercase">
            Filters
          </span>
          {count > 0 && (
            <button
              type="button"
              onClick={() => onChange(EMPTY_FILTERS)}
              className="text-[9px] font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Clear all ({count})
            </button>
          )}
        </div>
      </div>

      <FilterAccordion
        title="Stage"
        options={STAGE_OPTIONS}
        selected={filters.stages}
        onChange={(stages) => onChange({ ...filters, stages })}
        defaultOpen
      />
      <FilterAccordion
        title="Sector"
        options={SECTOR_OPTIONS}
        selected={filters.sectors}
        onChange={(sectors) => onChange({ ...filters, sectors })}
        searchable
        defaultOpen
      />
      <FilterAccordion
        title="Hiring Signal"
        options={HIRING_OPTIONS}
        selected={filters.hiringSignals}
        onChange={(hiringSignals) => onChange({ ...filters, hiringSignals })}
        defaultOpen
      />
      <FilterAccordion
        title="Culture Score"
        options={CULTURE_OPTIONS}
        selected={filters.cultureScores}
        onChange={(cultureScores) => onChange({ ...filters, cultureScores })}
      />
      <FilterAccordion
        title="Company Size"
        options={SIZE_OPTIONS}
        selected={filters.companySizes}
        onChange={(companySizes) => onChange({ ...filters, companySizes })}
      />
      <FilterAccordion
        title="Valuation"
        options={VALUATION_OPTIONS}
        selected={filters.valuationTiers}
        onChange={(valuationTiers) => onChange({ ...filters, valuationTiers })}
      />
      <FilterAccordion
        title="Location"
        options={LOCATION_OPTIONS}
        selected={filters.locations}
        onChange={(locations) => onChange({ ...filters, locations })}
        searchable
      />
      <FilterAccordion
        title="Tech Stack"
        options={TECH_OPTIONS}
        selected={filters.techStack}
        onChange={(techStack) => onChange({ ...filters, techStack })}
        searchable
      />
    </aside>
  );
}
