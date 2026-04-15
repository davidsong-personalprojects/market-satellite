export function formatValuation(billions: number | null): string {
  if (billions === null) return '—';
  if (billions >= 1) return `$${billions % 1 === 0 ? billions : billions.toFixed(1)}B`;
  return `$${Math.round(billions * 1000)}M`;
}

export function formatHeadcount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(count % 1000 === 0 ? 0 : 1)}k`;
  return count.toLocaleString();
}

export function formatGrowth(pct: number): string {
  const sign = pct > 0 ? '▲' : pct < 0 ? '▼' : '—';
  return `${sign} ${Math.abs(pct)}%`;
}

export function growthColorClass(pct: number): string {
  if (pct > 0) return 'text-green-600';
  if (pct < 0) return 'text-red-600';
  return 'text-gray-500';
}
