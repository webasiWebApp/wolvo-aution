import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuction, useBidsForAuction, useAuctions } from '@/lib/auctionQueries';
import { invokeFunction } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from '@/components/ui/image';
import CountdownTimer from '@/components/CountdownTimer';
import LiveStreamPanel from '@/components/live/LiveStreamPanel';
import AuctionCard from '@/components/AuctionCard';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, Gavel, Monitor, Building2, Layers, ArrowLeft, Info, BadgeCheck, LogIn, Settings, CreditCard, Boxes } from 'lucide-react';
import WatchButton from '@/components/WatchButton';
import BidReadiness from '@/components/BidReadiness';
import FeeSummary from '@/components/FeeSummary';
import { useTransactionForAuction } from '@/lib/transactionQueries';
import InspectionPanel from '@/components/events/InspectionPanel';
import AttendancePanel from '@/components/events/AttendancePanel';
import CommentsSection from '@/components/comments/CommentsSection';
import { maskBidderName } from '@/lib/utils';

const CONDITION_LABEL = {
  "New": "New",
  "Used - Like New": "Used - Like New",
  "Used - Good": "Used - Good",
  "Used - Fair": "Used - Fair",
  "For Parts or Repair": "For Parts or Repair",
  "Antique / Collectable": "Antique / Collectable"
};

function BiddingTypePill({ type }) {
  const map = {
    online: { icon: Monitor, label: "Online bidding" },
    physical: { icon: Building2, label: "In-person attendance" },
    hybrid: { icon: Layers, label: "Online & in-person" }
  };
  const { icon: Icon, label } = map[type] || map.online;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
      <Icon className="h-4 w-4" /> {label}
    </span>
  );
}

export default function AuctionDetails() {
  const { id } = useParams();
  const { data: auction, isLoading } = useAuction(id);
  const { data: bids = [], isLoading: bidsLoading } = useBidsForAuction(id);
  const { data: related = [] } = useAuctions({ category: auction?.category, status: 'open' }, { sort: '-closing_time', limit: 4 });
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { data: wonTx } = useTransactionForAuction(auction?.status === 'closed' ? auction?.id : null);

  const [bidAmount, setBidAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-foreground">Auction not found</h1>
        <p className="mt-2 text-muted-foreground">This listing may have been removed.</p>
        <Link to="/auctions"><Button className="mt-4">Back to auctions</Button></Link>
      </div>
    );
  }

  // Mirrors the server rule in shared/auctionBidding.ts: the first bid may be
  // the starting bid; later bids must beat the current bid by the increment.
  const startingBid = auction.starting_bid || 0;
  const currentBid = auction.current_highest_bid || startingBid;
  const minNext = (auction.bid_count || 0) > 0 ? currentBid + (auction.min_bid_increment || 0) : startingBid;
  const isOpen = auction.status === 'open';
  const relatedList = related.filter((a) => a.id !== auction.id).slice(0, 4);

  const handleBid = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const amount = Number(bidAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter a valid bid amount.'); return; }
    setSubmitting(true);
    try {
      const res = await invokeFunction('placeBid', { auction_id: id, amount });
      if (res.status >= 400) {
        setError(res.data?.error || 'Bid failed.');
      } else {
        setSuccess(`Bid of $${amount.toLocaleString('en-AU')} placed successfully!`);
        setBidAmount('');
        queryClient.invalidateQueries({ queryKey: ['auction', id] });
        queryClient.invalidateQueries({ queryKey: ['bids', id] });
        queryClient.invalidateQueries({ queryKey: ['auctions'] });
      }
    } catch (err) {
      setError(err.message || 'Bid failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      <Link to="/auctions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to auctions
      </Link>

      {auction.is_sample && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0" />
          This is a <strong>sample listing</strong> created for development and demonstration. It is not a real auction.
        </div>
      )}

      {(user?.role === 'admin' || user?.role === 'auctioneer') && (auction.bidding_type === 'physical' || auction.bidding_type === 'hybrid' || auction.inspections_available) && (
        <div className="mb-4 flex justify-end">
          <Link to={`/auctioneer/manage/${auction.id}`}><Button variant="outline" size="sm"><Settings className="h-4 w-4 mr-1" /> Manage event</Button></Link>
        </div>
      )}

      <div className="mb-4">
        <LiveStreamPanel targetType="auction" targetId={auction.id} />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Gallery */}
        <div>
          <div className="aspect-[4/3] rounded-xl overflow-hidden border border-border bg-muted">
            <Image src={auction.image_url} alt={auction.title} className="h-full w-full object-cover" />
          </div>
          {auction.images?.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {auction.images.slice(0, 4).map((img, i) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden border border-border">
                  <Image src={img} alt={`${auction.title} ${i + 1}`} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${auction.status === 'open' ? 'bg-emerald-100 text-emerald-800' : auction.status === 'upcoming' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'}`}>
              {auction.status === 'open' ? 'Live now' : auction.status === 'upcoming' ? 'Upcoming' : 'Closed'}
            </span>
            {auction.featured && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent text-accent-foreground">Featured</span>}
            <BiddingTypePill type={auction.bidding_type} />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{auction.title}</h1>
          {auction.category && <p className="text-sm text-muted-foreground mt-1">{auction.category}</p>}
          {auction.garage_sale_event_id && (
            <Link to={`/garage-sales/${auction.garage_sale_event_id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline mt-1">
              <Boxes className="h-3.5 w-3.5" /> Part of a garage sale
            </Link>
          )}

          <div className="mt-4">
            <WatchButton auctionId={auction.id} userId={user?.id} />
          </div>

          <div className="mt-5 rounded-xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Current highest bid</p>
            <p className="text-3xl font-bold text-foreground mt-1">
              ${currentBid.toLocaleString('en-AU', { minimumFractionDigits: 0 })}
            </p>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Starting bid: ${startingBid.toLocaleString('en-AU')}</span>
              <span className="text-muted-foreground">Min increment: ${(auction.min_bid_increment || 0).toLocaleString('en-AU')}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {auction.status === 'closed' ? 'Closed' : auction.status === 'upcoming' ? 'Starts' : 'Ends'}:
              </span>
              <CountdownTimer closingTime={auction.closing_time} variant="large" />
            </div>
          </div>

          {/* Bid box */}
          {isOpen ? (
            <div className="mt-4 rounded-xl border border-border bg-card p-5">
              {isAuthenticated ? (
                <form onSubmit={handleBid} className="space-y-3">
                  <BidReadiness />
                  <FeeSummary context="bidding" />
                  <label className="text-sm font-medium text-foreground">Place a bid</label>
                  <p className="text-xs text-muted-foreground">Minimum next bid: ${minNext.toLocaleString('en-AU')}</p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder={String(minNext)}
                      className="flex-1 h-11 rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <Button type="submit" disabled={submitting} className="h-11">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4 mr-1.5" />}
                      {submitting ? 'Placing…' : 'Place bid'}
                    </Button>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setBidAmount(String(minNext))}>
                    Bid ${minNext.toLocaleString('en-AU')}
                  </Button>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  {success && <p className="text-sm text-emerald-600 font-medium">{success}</p>}
                </form>
              ) : (
                <div className="text-center py-2">
                  <LogIn className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-foreground font-medium">Sign in to place a bid</p>
                  <p className="text-xs text-muted-foreground mt-1">Registration and bidding are free.</p>
                  <Link to="/login"><Button size="sm" className="mt-3">Sign in</Button></Link>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {wonTx && wonTx.buyer_id === user?.id ? (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5">
                  <p className="text-sm font-semibold text-emerald-900">You won this auction!</p>
                  <p className="text-xs text-emerald-800 mt-1">Winning bid: ${(wonTx.final_price || auction.current_highest_bid || 0).toLocaleString('en-AU')}.</p>
                  {wonTx.status === 'pending_payment' ? (
                    <Link to={`/transactions/${wonTx.id}`}><Button className="mt-3"><CreditCard className="h-4 w-4 mr-1.5" /> Pay now</Button></Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 mt-2"><BadgeCheck className="h-4 w-4" /> Payment {wonTx.status.replace(/_/g, ' ')}</span>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-muted/40 p-5 text-center">
                  <p className="text-sm text-muted-foreground">
                    {auction.status === 'upcoming' ? 'Bidding opens soon. Check back before the start time.' : 'This auction has closed.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Key facts */}
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border bg-card p-3">
              <dt className="text-xs text-muted-foreground">Condition</dt>
              <dd className="font-medium text-foreground mt-0.5">{CONDITION_LABEL[auction.condition] || auction.condition || '—'}</dd>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <dt className="text-xs text-muted-foreground">Location</dt>
              <dd className="font-medium text-foreground mt-0.5 inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {[auction.suburb, auction.state].filter(Boolean).join(', ') || '—'}
              </dd>
            </div>
            {auction.lot_number && (
              <div className="rounded-lg border border-border bg-card p-3">
                <dt className="text-xs text-muted-foreground">Lot number</dt>
                <dd className="font-medium text-foreground mt-0.5">{auction.lot_number}</dd>
              </div>
            )}
            <div className="rounded-lg border border-border bg-card p-3">
              <dt className="text-xs text-muted-foreground">Total bids</dt>
              <dd className="font-medium text-foreground mt-0.5 inline-flex items-center gap-1">
                <Gavel className="h-3.5 w-3.5" /> {auction.bid_count || 0}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Description */}
      {auction.description && (
        <div className="mt-8 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-3">Description</h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{auction.description}</p>
          {auction.viewing_notes && (
            <div className="mt-4 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-foreground">Viewing</h3>
              <p className="text-sm text-muted-foreground mt-1">{auction.viewing_notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Inspections & physical attendance */}
      <div className="mt-8 grid lg:grid-cols-2 gap-6">
        <InspectionPanel auctionId={auction.id} />
        <AttendancePanel auctionId={auction.id} />
      </div>

      {/* Bid history */}
      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Bid history</h2>
        {bidsLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : bids.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bids placed yet. Be the first to bid.</p>
        ) : (
          <ul className="divide-y divide-border">
            {bids.map((b, i) => (
              <li key={b.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {maskBidderName(b.bidder_name)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.created_date).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">${b.amount.toLocaleString('en-AU')}</p>
                  {i === 0 && <span className="text-xs text-emerald-600 font-medium">{isOpen ? 'Winning' : 'Highest bid'}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Comments */}
      <CommentsSection auction={auction} />

      {/* Related */}
      {relatedList.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-bold text-foreground mb-4">More in this category</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {relatedList.map((a) => <AuctionCard key={a.id} auction={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}