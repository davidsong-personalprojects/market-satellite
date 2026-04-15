'use client';

import { useState } from 'react';

interface Option<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface FilterAccordionProps<T extends string> {
  title: string;
  options: Option<T>[];
  selected: T[];
  onChange: (selected: T[]) => void;
  searchable?: boolean;
  defaultOpen?: boolean;
}

export function FilterAccordion<T extends string>({
  title,
  options,
  selected,
  onChange,
  searchable = false,
  defaultOpen = false,
}: FilterAccordionProps<T>) {
  const [open, setOpen] = useState(defaultOpen);
  const [search, setSearch] = useState('');

  const visible = searchable
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  function toggle(value: T) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

  return (
    <div className="border-b border-gray-100">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[10px] font-bold tracking-widest text-gray-500 uppercase hover:bg-gray-50"
      >
        {title}
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-3 flex flex-col gap-0.5">
          {searchable && (
            <input
              type="text"
              placeholder={`Search ${title.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-2 w-full rounded border border-gray-200 px-2 py-1 text-[10px] text-gray-700 outline-none focus:border-gray-400"
            />
          )}
          {visible.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 py-0.5">
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="h-3 w-3 accent-gray-800"
              />
              <span className="flex-1 text-[11px] text-gray-700">{opt.label}</span>
              {opt.count !== undefined && (
                <span className="text-[9px] text-gray-400">{opt.count}</span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
