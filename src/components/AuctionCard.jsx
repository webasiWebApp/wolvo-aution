import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Gavel, Monitor, Building2, Layers } from 'lucide-react';
import { Image } from '@/components/ui/image';
import CountdownTimer from '@/components/CountdownTimer';
import { cn } from '@/lib/utils';

const STATUS_STYLES = {
  upcoming: "bg-blue-100 text-blue-800",
  open: "bg-emerald-100 text-emerald-800",
  closed: "bg-slate-200 text-slate-700"
};

const STATUS_LABEL = {
  upcoming: "Upcoming",
  open: "Live Now",
  closed: "Closed"
};

function BiddingTypeBadge({ type }) {
  const map = {
    online: { icon: Monitor, label: "Online bidding" },
    physical: { icon: Building2, label: "In-person only" },
    hybrid: { icon: Layers, label: "Online & in-person" }
  };
  const { icon: Icon, label } = map[type] || map.online;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="w-3.5 h-3.5" /> {label}
    </span>
  );
}

export default function AuctionCard({ auction }) {
  const currentBid = auction.current_highest_bid || auction.starting_bid || 0;
  return (
    <Link
      to={`/auctions/${auction.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-lg hover:-translate-y-0.5"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <Image
          src={auction.image_url}
          alt={auction.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm", STATUS_STYLES[auction.status])}>
            {STATUS_LABEL[auction.status]}
          </span>
          {auction.featured && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent text-accent-foreground shadow-sm">
              Featured
            </span>
          )}
        </div>
        {auction.is_sample && (
          <div className="absolute bottom-3 left-3">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-black/70 text-white">
              Sample
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-4 flex-1">
        <div>
          <h3 className="font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {auction.title}
          </h3>
          {auction.category && (
            <p className="text-xs text-muted-foreground mt-1">{auction.category}</p>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="w-3.5 h-3.5" />
          <span>{auction.suburb ? `${auction.suburb}, ` : ""}{auction.state || "WA"}</span>
        </div>

        <div className="mt-auto space-y-2">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Current bid</p>
              <p className="text-lg font-bold text-foreground">
                ${currentBid.toLocaleString('en-AU', { minimumFractionDigits: 0 })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Bids</p>
              <p className="text-sm font-semibold inline-flex items-center gap-1">
                <Gavel className="w-3.5 h-3.5" /> {auction.bid_count || 0}
              </p>
            </div>
          </div>

          <BiddingTypeBadge type={auction.bidding_type} />

          <div className="pt-2 border-t border-border">
            <CountdownTimer closingTime={auction.closing_time} />
          </div>
        </div>
      </div>
    </Link>
  );
}