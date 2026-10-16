import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Gavel, ShieldCheck, TrendingUp, ArrowRight, MapPin } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuctions, useAuctionCategories } from '@/lib/auctionQueries';
import AuctionCard from '@/components/AuctionCard';
import { Button } from '@/components/ui/button';

export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const { data: featured = [] } = useAuctions({ status: 'open' }, { sort: '-closing_time', limit: 8 });
  const { data: categories = [] } = useAuctionCategories();

  const { data: counts } = useQuery({
    queryKey: ['home-counts'],
    queryFn: async () => {
      const [open, upcoming] = await Promise.all([
        base44.entities.Auction.count({ status: 'open' }),
        base44.entities.Auction.count({ status: 'upcoming' })
      ]);
      return { open, upcoming };
    }
  });

  const featuredList = featured.filter((a) => a.featured).concat(featured.filter((a) => !a.featured)).slice(0, 8);

  const onSearch = (e) => {
    e.preventDefault();
    navigate(`/auctions?q=${encodeURIComponent(query)}`);
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-primary text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1 text-sm font-medium text-accent">
              <MapPin className="h-3.5 w-3.5" /> Australia-wide
            </span>
            <h1 className="mt-4 text-4xl sm:text-5xl font-bold leading-tight">
              Bid with the pack on Australia's auction marketplace
            </h1>
            <p className="mt-4 text-lg text-primary-foreground/80">
              Discover vehicles, equipment, collectables and more across online, physical and hybrid auctions. Browse freely, no account needed.
            </p>
            <form onSubmit={onSearch} className="mt-8 flex flex-col sm:flex-row gap-3 max-w-xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search cars, tools, antiques..."
                  className="w-full pl-11 pr-3 h-12 rounded-lg border-0 bg-card text-foreground text-base focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <Button type="submit" size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 h-12">
                Search auctions
              </Button>
            </form>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-primary-foreground/80">
              <span className="inline-flex items-center gap-1.5"><Gavel className="h-4 w-4" /> {counts?.open || 0} live auctions</span>
              <span className="inline-flex items-center gap-1.5"><TrendingUp className="h-4 w-4" /> {counts?.upcoming || 0} upcoming</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Verified sellers</span>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <h2 className="text-xl font-bold text-foreground mb-4">Browse by category</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c}
                to={`/auctions?category=${encodeURIComponent(c)}`}
                className="px-4 py-2 rounded-full border border-border bg-card text-sm font-medium text-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {c}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured auctions */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Live auctions</h2>
          <div className="flex items-center gap-4">
          <Link to="/auctions" className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/garage-sales" className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1">
            Garage sales <ArrowRight className="h-4 w-4" />
          </Link>
          </div>
        </div>
        {featuredList.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
            No live auctions at the moment. Check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {featuredList.map((a) => (
              <AuctionCard key={a.id} auction={a} />
            ))}
          </div>
        )}
      </section>

      {/* Trust band */}
      <section className="bg-muted/50 border-y border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 grid gap-6 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Buy with confidence", text: "Verified sellers, transparent bidding and secure settlement." },
            { icon: Gavel, title: "Three ways to bid", text: "Online, in person, or hybrid, whatever suits the auction." },
            { icon: MapPin, title: "Nationwide reach", text: "Auctions across every state and territory, from coast to coast." }
          ].map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.title} className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{t.title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{t.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}