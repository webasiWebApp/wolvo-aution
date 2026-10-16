import React from 'react';

const MAP = {
  REGISTRATION_OPEN: { label: 'Registration open', cls: 'bg-blue-100 text-blue-800' },
  AWAITING_MINIMUM_ATTENDANCE: { label: 'Awaiting minimum attendance', cls: 'bg-amber-100 text-amber-800' },
  MINIMUM_ATTENDANCE_REACHED: { label: 'Minimum reached — seller confirmation required', cls: 'bg-emerald-100 text-emerald-800' },
  AWAITING_SELLER_CONFIRMATION: { label: 'Awaiting seller confirmation', cls: 'bg-amber-100 text-amber-800' },
  AUCTION_CONFIRMED: { label: 'Auction confirmed', cls: 'bg-emerald-100 text-emerald-800' },
  AUCTION_RESCHEDULED: { label: 'Rescheduled', cls: 'bg-orange-100 text-orange-800' },
  AUCTION_CANCELLED: { label: 'Cancelled', cls: 'bg-red-100 text-red-800' },
  AUCTION_COMPLETED: { label: 'Completed', cls: 'bg-slate-200 text-slate-700' }
};

export default function AttendanceStatusBadge({ status }) {
  const m = MAP[status] || { label: status || '—', cls: 'bg-slate-100 text-slate-600' };
  return <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>;
}