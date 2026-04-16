'use client';

import { useState } from 'react';
import type { Company } from '@/types/company';
import { CompanyRow } from '@/components/CompanyRow';

interface CompanyTableProps {
  companies: Company[];
  isLoading?: boolean;
}

const COLUMNS = [
  { label: 'Company',    align: 'left'  },
  { label: 'Batch',      align: 'right' },
  { label: 'HC Growth',  align: 'right' },
  { label: 'Valuation',  align: 'right' },
  { label: 'Employees',  align: 'right' },
  { label: 'Open Roles', align: 'right' },
] as const;

export function CompanyTable({ companies, isLoading = false }: CompanyTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleRow(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
        No companies match your filters.
      </div>
    );
  }

  return (
    <div className="overflow-auto flex-1">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-900">
            {COLUMNS.map((col) => (
              <th
                key={col.label}
                className={`py-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 ${
                  col.align === 'right'
                    ? 'px-4 text-right'
                    : 'pl-6 pr-4 text-left'
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <CompanyRow
              key={company.id}
              company={company}
              isExpanded={expandedId === company.id}
              onToggle={() => toggleRow(company.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
