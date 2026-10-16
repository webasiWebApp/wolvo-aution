import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, Search, ShieldCheck, LogOut, Heart, Gavel, BadgeCheck, Receipt, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

const LOGO_URL = 'https://media.base44.com/images/public/6acf0f20dea3206601d70422/87021ca00_generated_image.png';

const NAV_LINKS = [
  { label: "Browse", path: "/auctions" },
  { label: "Garage Sales", path: "/garage-sales" },
  { label: "Upcoming", path: "/upcoming" },
  { label: "Completed", path: "/completed" },
  { label: "How It Works", path: "/how-it-works" },
  { label: "Contact", path: "/contact" }
];

const AUTHED_LINKS = [
  { label: "Verify ID", path: "/verify", icon: BadgeCheck },
  { label: "Watchlist", path: "/watchlist", icon: Heart },
  { label: "My Bids", path: "/my-bids", icon: Gavel },
  { label: "Transactions", path: "/my-transactions", icon: Receipt },
  { label: "Security", path: "/security", icon: ShieldCheck }
];

export default function PublicNav() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const onSearch = (e) => {
    e.preventDefault();
    navigate(`/auctions?q=${encodeURIComponent(query)}`);
    setOpen(false);
  };

  const handleLogout = () => {
    logout(false);
    navigate('/');
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-primary text-primary-foreground select-none" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <img src={LOGO_URL} alt="Wolvo" className="h-9 w-9 rounded-lg object-cover" />
            <span className="font-bold text-lg tracking-tight">WOLVO</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <Link key={l.path} to={l.path} className="px-3 py-2 text-sm font-medium text-primary-foreground/75 hover:text-primary-foreground rounded-md transition-colors">
                {l.label}
              </Link>
            ))}
            {isAuthenticated && AUTHED_LINKS.map((l) => (
              <Link key={l.path} to={l.path} className="px-3 py-2 text-sm font-medium text-primary-foreground/75 hover:text-primary-foreground rounded-md transition-colors">
                {l.label}
              </Link>
            ))}
            {isAuthenticated && user?.role === 'auctioneer' && (
              <Link to="/auctioneer" className="px-3 py-2 text-sm font-medium text-accent hover:text-accent-foreground rounded-md transition-colors">Auctioneer</Link>
            )}
            {isAuthenticated && (user?.role === 'auctioneer' || user?.role === 'admin') && (
              <Link to="/go-live" className="px-3 py-2 text-sm font-medium text-red-500 hover:text-red-400 rounded-md transition-colors inline-flex items-center gap-1">
                <Radio className="h-4 w-4" /> Go Live
              </Link>
            )}
          </nav>

          <form onSubmit={onSearch} className="hidden md:flex items-center relative w-56">
            <Search className="absolute left-2.5 h-4 w-4 text-primary-foreground/50 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search auctions"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-white/15 bg-white/10 text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </form>

          <div className="hidden md:flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {user?.role === 'admin' && (
                  <Link to="/admin">
                    <Button variant="outline" size="sm" className="border-white/20 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
                      <ShieldCheck className="h-4 w-4 mr-1" /> Admin
                    </Button>
                  </Link>
                )}
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-primary-foreground/75 hover:text-primary-foreground hover:bg-white/10">
                  <LogOut className="h-4 w-4 mr-1" /> Sign out
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">Sign in</Button>
              </Link>
            )}
          </div>

          <button
            className="lg:hidden p-2 rounded-md text-primary-foreground"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-white/10 bg-primary">
          <div className="px-4 py-3 space-y-1">
            <form onSubmit={onSearch} className="relative mb-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-primary-foreground/50" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search auctions"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-white/15 bg-white/10 text-primary-foreground placeholder:text-primary-foreground/50"
              />
            </form>
            {NAV_LINKS.map((l) => (
              <Link key={l.path} to={l.path} onClick={() => setOpen(false)} className="block px-3 py-2 text-sm font-medium rounded-md text-primary-foreground/85 hover:bg-white/10">
                {l.label}
              </Link>
            ))}
            {isAuthenticated && AUTHED_LINKS.map((l) => {
              const Icon = l.icon;
              return (
                <Link key={l.path} to={l.path} onClick={() => setOpen(false)} className="block px-3 py-2 text-sm font-medium rounded-md text-primary-foreground/85 hover:bg-white/10">
                  <Icon className="h-4 w-4 inline mr-2" /> {l.label}
                </Link>
              );
            })}
            {isAuthenticated && user?.role === 'auctioneer' && (
              <Link to="/auctioneer" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm font-medium rounded-md text-accent hover:bg-white/10">Auctioneer</Link>
            )}
            {isAuthenticated && (user?.role === 'auctioneer' || user?.role === 'admin') && (
              <Link to="/go-live" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm font-medium rounded-md text-red-400 hover:bg-white/10">
                <Radio className="h-4 w-4 inline mr-2" /> Go Live
              </Link>
            )}
            {isAuthenticated ? (
              <>
                {user?.role === 'admin' && (
                  <Link to="/admin" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm font-medium rounded-md text-primary-foreground/85 hover:bg-white/10">
                    <ShieldCheck className="h-4 w-4 inline mr-2" /> Admin
                  </Link>
                )}
                <button onClick={handleLogout} className="w-full text-left block px-3 py-2 text-sm font-medium rounded-md text-primary-foreground/85 hover:bg-white/10">
                  <LogOut className="h-4 w-4 inline mr-2" /> Sign out
                </button>
              </>
            ) : (
              <Link to="/login" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm font-medium rounded-md text-accent hover:bg-white/10">
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}