'use client';

import { useState, useMemo } from 'react';
import type { CompanyType, FilterState } from '@/types/company';
import { COMPANIES } from '@/lib/data';
import { filterCompanies, EMPTY_FILTERS } from '@/lib/filterCompanies';
import { TopBar } from '@/components/TopBar';
import { Sidebar } from '@/components/Sidebar';
import { CompanyTable } from '@/components/CompanyTable';

export default function Dashboard() {
  const [companyType, setCompanyType] = useState<CompanyType>('venture');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  function handleSearchChange(search: string) {
    setFilters((f) => ({ ...f, search }));
  }

  const typeFiltered = useMemo(
    () => COMPANIES.filter((c) => c.type === companyType),
    [companyType],
  );

  const displayed = useMemo(
    () => filterCompanies(typeFiltered, filters),
    [typeFiltered, filters],
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <TopBar
        companyType={companyType}
        onCompanyTypeChange={(type) => {
          setCompanyType(type);
          setFilters(EMPTY_FILTERS);
        }}
        search={filters.search}
        onSearchChange={handleSearchChange}
        resultCount={displayed.length}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar filters={filters} onChange={setFilters} />
        <main className="flex flex-1 flex-col overflow-hidden">
          <CompanyTable companies={displayed} />
        </main>
      </div>
    </div>
  );
}
