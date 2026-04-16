'use client';

import type { Company } from '@/types/company';
import {
  formatValuation,
  formatHeadcount,
  formatGrowth,
  growthColorClass,
} from '@/lib/formatters';

interface CompanyRowProps {
  company: Company;
  isExpanded: boolean;
  onToggle: () => void;
}

export function CompanyRow({ company: c, isExpanded, onToggle }: CompanyRowProps) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-gray-100 text-[11px] transition-colors hover:bg-gray-50 ${
          isExpanded ? 'bg-blue-50/40' : ''
        }`}
      >
        <td className="py-2.5 pl-6 pr-4">
          <div className="font-semibold text-gray-900">{c.name}</div>
          <div className="text-[10px] text-gray-400 truncate max-w-xs">{c.description}</div>
        </td>
        <td className="py-2.5 px-4 text-right font-semibold tabular-nums text-gray-500">
          {c.batch}
        </td>
        <td
          className={`py-2.5 px-4 text-right font-semibold tabular-nums ${
            c.hcGrowthPct !== null ? growthColorClass(c.hcGrowthPct) : 'text-gray-400'
          }`}
        >
          {c.hcGrowthPct !== null ? formatGrowth(c.hcGrowthPct) : '—'}
        </td>
        <td className="py-2.5 px-4 text-right font-semibold tabular-nums text-indigo-600">
          {formatValuation(c.valuation)}
        </td>
        <td className="py-2.5 px-4 text-right font-semibold tabular-nums text-sky-600">
          {formatHeadcount(c.employeeCount)}
        </td>
        <td className="py-2.5 pl-4 pr-6 text-right font-semibold tabular-nums text-slate-500">
          {c.openRoles}
        </td>
      </tr>

      {isExpanded && (
        <tr className="border-b border-gray-200 bg-gray-50/70">
          <td colSpan={6} className="px-6 py-3">
            <div className="flex flex-wrap gap-6 text-[10px]">
              {c.lastRound && (
                <div>
                  <span className="font-bold uppercase tracking-wider text-gray-400">Last Round</span>
                  <p className="mt-1 text-gray-700">{c.lastRound}</p>
                </div>
              )}
              <div>
                <span className="font-bold uppercase tracking-wider text-gray-400">Location</span>
                <p className="mt-1 text-gray-700">{c.location}</p>
              </div>
              <div>
                <span className="font-bold uppercase tracking-wider text-gray-400">Website</span>
                <p className="mt-1">
                  <a
                    href={c.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-600 hover:underline"
                  >
                    {c.website.replace(/^https?:\/\//, '')} ↗
                  </a>
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
