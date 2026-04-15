'use client';

import type { CompanyType } from '@/types/company';

interface TopBarProps {
  companyType: CompanyType;
  onCompanyTypeChange: (type: CompanyType) => void;
  search: string;
  onSearchChange: (search: string) => void;
  resultCount: number;
}

export function TopBar({
  companyType,
  onCompanyTypeChange,
  search,
  onSearchChange,
  resultCount,
}: TopBarProps) {
  return (
    <header className="flex items-center gap-4 border-b border-gray-200 bg-white px-6 py-3 shrink-0">
      <span className="text-sm font-bold tracking-tight text-gray-900">
        Company Screener
      </span>

      <div className="flex rounded-md border border-gray-200 overflow-hidden text-[11px] font-semibold">
        {(['venture', 'public'] as CompanyType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onCompanyTypeChange(type)}
            className={`px-4 py-1.5 transition-colors ${
              companyType === type
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            {type === 'venture' ? 'Venture-Backed' : 'Public Equities'}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="text-[11px] text-gray-400">
          {resultCount} {resultCount === 1 ? 'company' : 'companies'}
        </span>
        <input
          type="search"
          placeholder="Search companies…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-44 rounded border border-gray-200 px-3 py-1.5 text-[11px] text-gray-700 outline-none focus:border-gray-400 placeholder:text-gray-400"
        />
      </div>
    </header>
  );
}
