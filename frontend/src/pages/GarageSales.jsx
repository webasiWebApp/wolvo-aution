import React from 'react';
import { Link } from 'react-router-dom';
import { useGarageSaleEvents } from '@/lib/garageSaleQueries';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Image } from '@/components/ui/image';
import { Loader2, MapPin, Calendar, Plus, Home, Layers, Building2, Monitor } from 'lucide-react';

const PARTICP_LABEL = { online: 'Online', physical: 'In-person', hybrid: 'Online & in-person' };
const PARTICP_ICON = { online: Monitor, physical: Building2, hybrid: Layers };

export default function GarageSales() {
  const { data: events = [], isLoading } = useGarageSaleEvents('open');
  const { isAuthenticated } = useAuth();
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Garage sales & house clearances</h1>
          <p className="mt-1.5 text-muted-foreground">Multi-item clearance events. Bid on each item separately.</p>
        </div>
        {isAuthenticated && (
          <Link to="/sell-garage-sale"><Button><Plus className="h-4 w-4 mr-1" /> Host a sale</Button></Link>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Home className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No garage sale events listed yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map((ev) => {
            const Icon = PARTICP_ICON[ev.participation] || Monitor;
            const img = (ev.images && ev.images[0]) || '';
            return (
              <Link key={ev.id} to={`/garage-sales/${ev.id}`} className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-lg hover:-translate-y-0.5">
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  {img ? (
                    <Image src={img} alt={ev.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground"><Home className="h-10 w-10" /></div>
                  )}
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary text-primary-foreground shadow-sm inline-flex items-center gap-1">
                    <Icon className="h-3 w-3" /> {PARTICP_LABEL[ev.participation]}
                  </span>
                </div>
                <div className="p-4 flex flex-col gap-2 flex-1">
                  <h3 className="font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">{ev.title}</h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {ev.suburb ? `${ev.suburb}, ` : ''}{ev.state || 'AU'}</div>
                  {ev.event_start && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5" /> {new Date(ev.event_start).toLocaleDateString('en-AU', { dateStyle: 'medium' })}</div>
                  )}
                  {ev.description && <p className="text-sm text-muted-foreground line-clamp-2">{ev.description}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}