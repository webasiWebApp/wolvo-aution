import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Gavel, Users, Settings, ShieldCheck, Wallet, ArrowLeft, Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

const LOGO_URL = 'https://media.base44.com/images/public/6acf0f20dea3206601d70422/87021ca00_generated_image.png';

const NAV = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { label: "Listings", path: "/admin/listings", icon: Gavel },
  { label: "Accounts", path: "/admin/accounts", icon: Users },
  { label: "Verifications", path: "/admin/verifications", icon: ShieldCheck },
  { label: "Payments", path: "/admin/payments", icon: Wallet },
  { label: "Pricing", path: "/admin/settings", icon: Settings }
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const isActive = (path) => path === "/admin" ? location.pathname === "/admin" : location.pathname.startsWith(path);

  const handleLogout = () => {
    logout(false);
    navigate("/");
  };

  const Brand = () => (
    <Link to="/admin" className="flex items-center gap-2.5">
      <img src={LOGO_URL} alt="Wolvo" className="h-8 w-8 rounded-lg object-cover" />
      <div className="leading-tight">
        <span className="block font-bold tracking-tight text-primary-foreground">WOLVO</span>
        <span className="block text-[10px] uppercase tracking-widest text-primary-foreground/50 -mt-0.5">Admin</span>
      </div>
    </Link>
  );

  const navLink = (item) => {
    const Icon = item.icon;
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => setOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
          isActive(item.path)
            ? "bg-accent text-accent-foreground"
            : "text-primary-foreground/70 hover:bg-white/10 hover:text-primary-foreground"
        )}
      >
        <Icon className="h-4 w-4" /> {item.label}
      </Link>
    );
  };

  const footerLinks = () => (
    <>
      <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-primary-foreground/70 hover:bg-white/10 hover:text-primary-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to marketplace
      </Link>
      <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-primary-foreground/70 hover:bg-white/10 hover:text-primary-foreground">
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </>
  );

  return (
    <div className="min-h-screen bg-muted/40 flex" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-white/10 bg-primary">
        <div className="h-16 flex items-center px-5 border-b border-white/10">
          <Brand />
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(navLink)}
        </nav>
        <div className="p-3 border-t border-white/10 space-y-1">
          {footerLinks()}
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4 border-b border-white/10 bg-primary">
        <Brand />
        <button onClick={() => setOpen(true)} className="p-2 text-primary-foreground"><Menu className="h-6 w-6" /></button>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setOpen(false)}>
          <div className="absolute left-0 top-0 h-full w-72 bg-primary p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-primary-foreground">Menu</span>
              <button onClick={() => setOpen(false)} className="text-primary-foreground"><X className="h-6 w-6" /></button>
            </div>
            <nav className="space-y-1">
              {NAV.map(navLink)}
              {footerLinks()}
            </nav>
          </div>
        </div>
      )}

      <div className="flex-1 lg:pt-0 pt-14 overflow-x-hidden">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}