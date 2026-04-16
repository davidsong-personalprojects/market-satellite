'use client';

import { FilterAccordion } from '@/components/ui/FilterAccordion';
import { EMPTY_FILTERS } from '@/lib/filterCompanies';
import type { FilterState, CompanySizeBand, ValuationTier } from '@/types/company';

interface SidebarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

const BATCH_OPTIONS = [
  'W26', 'SP26', 'F25', 'SP25', 'S25', 'W25', 'F24', 'SP24',
  'S24', 'W24', 'F23', 'SP23', 'S23', 'W23', 'S22', 'W22',
].map((b) => ({ value: b, label: b }));

const SECTOR_OPTIONS = [
  'AI / ML', 'Developer Tools', 'Cybersecurity', 'Cloud Infra', 'Data / Analytics',
  'SaaS / Enterprise', 'Fintech', 'Crypto / Web3', 'Insurtech', 'Healthtech',
  'Biotech / Pharma', 'Cleantech / Climate', 'Defense / Aerospace', 'Edtech',
  'Proptech / Real Estate', 'Logistics / Supply Chain', 'Consumer / E-commerce',
  'Media / Creator Economy', 'Legal / Legaltech', 'HR / Future of Work',
].map((s) => ({ value: s, label: s }));

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

const activeCount = (filters: FilterState): number =>
  filters.batches.length +
  filters.sectors.length +
  filters.companySizes.length +
  filters.valuationTiers.length +
  filters.locations.length +
  (filters.activeOnly ? 1 : 0);

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

      {/* Active Hiring toggle */}
      <div className="border-b border-gray-100 px-4 py-2.5">
        <label className="flex cursor-pointer items-center justify-between">
          <span className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
            Active Hiring
          </span>
          <input
            type="checkbox"
            checked={filters.activeOnly}
            onChange={(e) => onChange({ ...filters, activeOnly: e.target.checked })}
            className="h-3.5 w-3.5 accent-gray-800"
          />
        </label>
      </div>

      <FilterAccordion
        title="Batch"
        options={BATCH_OPTIONS}
        selected={filters.batches}
        onChange={(batches) => onChange({ ...filters, batches })}
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
    </aside>
  );
}
