import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuction } from '@/lib/auctionQueries';
import ManageInspections from '@/components/events/ManageInspections';
import ManageAttendance from '@/components/events/ManageAttendance';
import CheckInConsole from '@/components/events/CheckInConsole';
import { ArrowLeft, Eye, Building2, Ticket, Loader2 } from 'lucide-react';

const TABS = [
  { key: 'inspections', label: 'Inspections', icon: Eye },
  { key: 'attendance', label: 'Attendance', icon: Building2 },
  { key: 'checkin', label: 'Check-in', icon: Ticket }
];

export default function ManageEvent() {
  const { id } = useParams();
  const { data: auction, isLoading } = useAuction(id);
  const [tab, setTab] = useState('inspections');
  const physical = auction && (auction.bidding_type === 'physical' || auction.bidding_type === 'hybrid');

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!auction) return <div className="mx-auto max-w-2xl px-4 py-20 text-center"><p className="text-muted-foreground">Auction not found.</p><Link to="/auctioneer" className="text-primary underline">Back to console</Link></div>;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
      <Link to="/auctioneer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="h-4 w-4" /> Back to console</Link>
      <h1 className="text-2xl font-bold text-foreground">{auction.title}</h1>
      <p className="text-sm text-muted-foreground mb-4 capitalize">{auction.bidding_type} auction · manage inspections and attendance</p>

      <div className="flex gap-1 border-b border-border mb-5">
        {TABS.filter((t) => physical || t.key === 'inspections').map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-1.5 ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'inspections' && <ManageInspections auctionId={id} />}
      {tab === 'attendance' && (physical ? <ManageAttendance auctionId={id} /> : <p className="text-sm text-muted-foreground">Online auctions have no physical attendance.</p>)}
      {tab === 'checkin' && (physical ? <CheckInConsole auctionId={id} /> : <p className="text-sm text-muted-foreground">Online auctions have no on-site check-in.</p>)}
    </div>
  );
}