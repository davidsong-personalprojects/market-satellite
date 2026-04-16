'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CompanyType, FilterState, Company } from '@/types/company';
import { EMPTY_FILTERS, buildQueryString } from '@/lib/filterCompanies';
import { TopBar } from '@/components/TopBar';
import { Sidebar } from '@/components/Sidebar';
import { CompanyTable } from '@/components/CompanyTable';

export default function Dashboard() {
  const [companyType, setCompanyType] = useState<CompanyType>('venture');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  const qs = buildQueryString(companyType, filters);

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ['companies', qs],
    queryFn: () => fetch(`/api/companies?${qs}`).then((r) => r.json()),
  });

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <TopBar
        companyType={companyType}
        onCompanyTypeChange={(type) => {
          setCompanyType(type);
          setFilters(EMPTY_FILTERS);
        }}
        search={filters.search}
        onSearchChange={(search) => setFilters((f) => ({ ...f, search }))}
        resultCount={companies.length}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar filters={filters} onChange={setFilters} />
        <main className="flex flex-1 flex-col overflow-hidden">
          <CompanyTable companies={companies} isLoading={isLoading} />
        </main>
      </div>
    </div>
  );
}
