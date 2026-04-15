import { describe, it, expect } from 'vitest';
import { filterCompanies, EMPTY_FILTERS } from './filterCompanies';
import type { Company, FilterState } from '@/types/company';

const BASE: Company = {
  id: 'test',
  name: 'TestCo',
  type: 'venture',
  sector: 'Fintech',
  stage: 'series-b',
  hcGrowthPct: 20,
  valuation: 1.5,
  marketCap: null,
  cultureScore: 4.2,
  employeeCount: 300,
  openRoles: 10,
  techStack: ['Go', 'Python'],
  investors: ['Sequoia'],
  engBlogUrl: null,
  lastRound: 'Series B · Jan 2023',
  location: 'New York City',
  website: 'https://testco.com',
};

describe('filterCompanies', () => {
  it('returns all companies when filters are empty', () => {
    const companies = [BASE, { ...BASE, id: 'b' }];
    expect(filterCompanies(companies, EMPTY_FILTERS)).toHaveLength(2);
  });

  it('filters by search name (case-insensitive)', () => {
    const companies = [BASE, { ...BASE, id: 'b', name: 'Acme' }];
    const result = filterCompanies(companies, { ...EMPTY_FILTERS, search: 'test' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test');
  });

  it('filters by stage (OR within group)', () => {
    const a = { ...BASE, id: 'a', stage: 'series-a' } as Company;
    const b = { ...BASE, id: 'b', stage: 'series-c' } as Company;
    const result = filterCompanies([BASE, a, b], {
      ...EMPTY_FILTERS,
      stages: ['series-b', 'series-c'],
    });
    expect(result.map((c) => c.id)).toEqual(['test', 'b']);
  });

  it('filters by sector', () => {
    const other = { ...BASE, id: 'other', sector: 'AI / ML' };
    const result = filterCompanies([BASE, other], {
      ...EMPTY_FILTERS,
      sectors: ['Fintech'],
    });
    expect(result).toHaveLength(1);
    expect(result[0].sector).toBe('Fintech');
  });

  it('hiring signal: rapid = hcGrowthPct > 25', () => {
    const rapid = { ...BASE, id: 'rapid', hcGrowthPct: 30 };
    const result = filterCompanies([BASE, rapid], {
      ...EMPTY_FILTERS,
      hiringSignals: ['rapid'],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('rapid');
  });

  it('hiring signal: shrinking = hcGrowthPct < 0', () => {
    const shrinking = { ...BASE, id: 'shrinking', hcGrowthPct: -5 };
    const result = filterCompanies([BASE, shrinking], {
      ...EMPTY_FILTERS,
      hiringSignals: ['shrinking'],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('shrinking');
  });

  it('culture band: excellent = score >= 4.5', () => {
    const excellent = { ...BASE, id: 'exc', cultureScore: 4.8 };
    const result = filterCompanies([BASE, excellent], {
      ...EMPTY_FILTERS,
      cultureScores: ['excellent'],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('exc');
  });

  it('company size: medium = 201–1000 employees', () => {
    const micro = { ...BASE, id: 'micro', employeeCount: 10 };
    const result = filterCompanies([BASE, micro], {
      ...EMPTY_FILTERS,
      companySizes: ['medium'],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test');
  });

  it('valuation tier: 1b-10b matches valuation of 1.5B', () => {
    const sub = { ...BASE, id: 'sub', valuation: 0.05 };
    const result = filterCompanies([BASE, sub], {
      ...EMPTY_FILTERS,
      valuationTiers: ['1b-10b'],
    });
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

  it('filters by tech stack (OR: any match is a hit)', () => {
    const goOnly = { ...BASE, id: 'go', techStack: ['Go'] };
    const result = filterCompanies([BASE, goOnly], {
      ...EMPTY_FILTERS,
      techStack: ['Go'],
    });
    expect(result).toHaveLength(2); // both BASE and goOnly have Go
  });

  it('combines filters with AND logic across groups', () => {
    const match = { ...BASE, id: 'match', sector: 'Fintech', stage: 'series-b' } as Company;
    const wrongSector = { ...BASE, id: 'ws', sector: 'AI / ML', stage: 'series-b' } as Company;
    const result = filterCompanies([match, wrongSector], {
      ...EMPTY_FILTERS,
      stages: ['series-b'],
      sectors: ['Fintech'],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('match');
  });
});
