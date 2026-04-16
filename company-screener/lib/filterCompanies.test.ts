import { describe, it, expect } from 'vitest';
import { filterCompanies, EMPTY_FILTERS, buildQueryString } from './filterCompanies';
import type { Company, FilterState, CompanyType } from '@/types/company';

const BASE: Company = {
  id: 'test',
  name: 'TestCo',
  type: 'venture',
  sector: 'Fintech',
  batch: 'W22',
  description: 'Test company',
  hcGrowthPct: 20,
  valuation: 1.5,
  employeeCount: 300,
  openRoles: 10,
  isActivelyHiring: true,
  lastRound: 'Series B · Jan 2023',
  location: 'New York City',
  website: 'https://testco.com',
};

describe('filterCompanies', () => {
  it('returns all companies when filters are empty', () => {
    expect(filterCompanies([BASE, { ...BASE, id: 'b' }], EMPTY_FILTERS)).toHaveLength(2);
  });

  it('filters by search name (case-insensitive)', () => {
    const result = filterCompanies([BASE, { ...BASE, id: 'b', name: 'Acme' }], {
      ...EMPTY_FILTERS,
      search: 'test',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test');
  });

  it('filters by batch (OR within group)', () => {
    const w21 = { ...BASE, id: 'w21', batch: 'W21' };
    const s22 = { ...BASE, id: 's22', batch: 'S22' };
    const result = filterCompanies([BASE, w21, s22], {
      ...EMPTY_FILTERS,
      batches: ['W22', 'S22'],
    });
    expect(result.map((c) => c.id)).toEqual(['test', 's22']);
  });

  it('filters by sector', () => {
    const other = { ...BASE, id: 'other', sector: 'AI / ML' };
    const result = filterCompanies([BASE, other], { ...EMPTY_FILTERS, sectors: ['Fintech'] });
    expect(result).toHaveLength(1);
    expect(result[0].sector).toBe('Fintech');
  });

  it('filters activeOnly', () => {
    const inactive = { ...BASE, id: 'inactive', isActivelyHiring: false };
    const result = filterCompanies([BASE, inactive], { ...EMPTY_FILTERS, activeOnly: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test');
  });

  it('company size: medium = 201-1000 employees', () => {
    const micro = { ...BASE, id: 'micro', employeeCount: 10 };
    const result = filterCompanies([BASE, micro], { ...EMPTY_FILTERS, companySizes: ['medium'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test');
  });

  it('valuation tier: 1b-10b matches valuation 1.5B', () => {
    const sub = { ...BASE, id: 'sub', valuation: 0.05 };
    const result = filterCompanies([BASE, sub], { ...EMPTY_FILTERS, valuationTiers: ['1b-10b'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test');
  });

  it('valuation tier: skips companies with null valuation', () => {
    const noVal = { ...BASE, id: 'noVal', valuation: null };
    const result = filterCompanies([BASE, noVal], { ...EMPTY_FILTERS, valuationTiers: ['1b-10b'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test');
  });

  it('filters by location', () => {
    const sf = { ...BASE, id: 'sf', location: 'San Francisco Bay Area' };
    const result = filterCompanies([BASE, sf], {
      ...EMPTY_FILTERS,
      locations: ['San Francisco Bay Area'],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('sf');
  });

  it('combines filters with AND logic across groups', () => {
    const match = { ...BASE, id: 'match', sector: 'Fintech', batch: 'W22' };
    const wrongSector = { ...BASE, id: 'ws', sector: 'AI / ML', batch: 'W22' };
    const result = filterCompanies([match, wrongSector], {
      ...EMPTY_FILTERS,
      batches: ['W22'],
      sectors: ['Fintech'],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('match');
  });
});

describe('buildQueryString', () => {
  it('includes type and search', () => {
    const qs = buildQueryString('venture', { ...EMPTY_FILTERS, search: 'acme' });
    expect(qs).toContain('type=venture');
    expect(qs).toContain('search=acme');
  });

  it('omits empty arrays', () => {
    const qs = buildQueryString('venture', EMPTY_FILTERS);
    expect(qs).not.toContain('sectors');
    expect(qs).not.toContain('batches');
  });

  it('serialises multi-value filters as comma-separated', () => {
    const qs = buildQueryString('venture', { ...EMPTY_FILTERS, sectors: ['Fintech', 'AI / ML'] });
    expect(qs).toContain('Fintech');
    expect(qs).toContain('AI');
  });

  it('includes activeOnly only when true', () => {
    const inactive = buildQueryString('venture', { ...EMPTY_FILTERS, activeOnly: false });
    expect(inactive).not.toContain('activeOnly');
    const active = buildQueryString('venture', { ...EMPTY_FILTERS, activeOnly: true });
    expect(active).toContain('activeOnly=true');
  });
});
