import React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import MobileSelect from '@/components/MobileSelect';

const CATEGORY_OPTIONS = [];
const STATUS_OPTIONS = [
  { value: 'open', label: 'Live now' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'closed', label: 'Closed' }
];
const FORMAT_OPTIONS = [
  { value: 'online', label: 'Online bidding' },
  { value: 'physical', label: 'In-person only' },
  { value: 'hybrid', label: 'Online & in-person' }
];
const PRICE_OPTIONS = [
  { value: '0-500', label: 'Under $500' },
  { value: '500-2000', label: '$500 – $2,000' },
  { value: '2000-10000', label: '$2,000 – $10,000' },
  { value: '10000-999999999', label: '$10,000+' }
];
const STATE_OPTIONS = [
  { value: 'WA', label: 'Western Australia' },
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'NT', label: 'Northern Territory' },
  { value: 'ACT', label: 'ACT' }
];

export default function AuctionFilters({ value, onChange, categories }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const categoryOptions = (categories || []).map((c) => ({ value: c, label: c }));

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          value={value.q || ""}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Search by title or keyword"
          className="w-full pl-10 pr-3 h-10 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <SlidersHorizontal className="h-4 w-4" /> Filters
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MobileSelect
          value={value.category || ""}
          onChange={(v) => set({ category: v })}
          placeholder="All categories"
          options={categoryOptions}
        />
        <MobileSelect
          value={value.status || ""}
          onChange={(v) => set({ status: v })}
          placeholder="Any status"
          options={STATUS_OPTIONS}
        />
        <MobileSelect
          value={value.bidding_type || ""}
          onChange={(v) => set({ bidding_type: v })}
          placeholder="Any format"
          options={FORMAT_OPTIONS}
        />
        <MobileSelect
          value={value.price || ""}
          onChange={(v) => set({ price: v })}
          placeholder="Any price"
          options={PRICE_OPTIONS}
        />
        <MobileSelect
          value={value.state || ""}
          onChange={(v) => set({ state: v })}
          placeholder="All locations"
          options={STATE_OPTIONS}
        />
      </div>
    </div>
  );
}