import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGarageSaleEvent, useEventItems } from '@/lib/garageSaleQueries';
import { useAuth } from '@/lib/AuthContext';
import { invokeFunction } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import AuctionCard from '@/components/AuctionCard';
import { Button } from '@/components/ui/button';
import { Image } from '@/components/ui/image';
import { Loader2, MapPin, Calendar, PackagePlus, Settings, ArrowLeft, Layers, Building2, Monitor, Clock } from 'lucide-react';
import EventAttendancePanel from '@/components/events/EventAttendancePanel';
import LiveStreamPanel from '@/components/live/LiveStreamPanel';

const PARTICP = {
  online: { icon: Monitor, label: 'Online' },
  physical: { icon: Building2, label: 'In-person' },
  hybrid: { icon: Layers, label: 'Online & in-person' }
};

const EMPTY = { title: '', description: '', starting_bid: '', reserve_price: '', min_bid_increment: '10', closing_time: '', image_url: '', bidding_type: '' };

export default function GarageSaleEvent() {
  const { id } = useParams();
  const { data: event, isLoading } = useGarageSaleEvent(id);
  const { data: items = [], isLoading: itemsLoading } = useEventItems(id);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const isOwner = !!(user && event && (event.created_by_id === user.id || user.role === 'admin'));

  const addItem = async (e) => {
    e.preventDefault();
    setErr('');
    if (!form.title.trim() || !form.starting_bid || !form.closing_time) {
      setErr('Title, starting bid and closing time are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await invokeFunction('manageGarageSaleEvent', {
        action: 'add_item', event_id: id,
        title: form.title, description: form.description, image_url: form.image_url,
        starting_bid: Number(form.starting_bid), reserve_price: Number(form.reserve_price) || 0,
        min_bid_increment: Number(form.min_bid_increment) || 10, closing_time: new Date(form.closing_time).toISOString(),
        bidding_type: form.bidding_type
      });
      if (res.status >= 400) {
        setErr((res.data && res.data.error) || 'Could not add item.');
      } else {
        setForm(EMPTY);
        setShowAdd(false);
        queryClient.invalidateQueries({ queryKey: ['event-items', id] });
      }
    } catch (ex) {
      setErr(ex.message || 'Could not add item.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (!event) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-foreground">Event not found</h1>
        <Link to="/garage-sales"><Button className="mt-4">Back to garage sales</Button></Link>
      </div>
    );
  }

  const P = PARTICP[event.participation] || PARTICP.online;
  const PIcon = P.icon;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      <Link to="/garage-sales" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to garage sales
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {event.images && event.images[0] && (
            <div className="aspect-[16/9] rounded-xl overflow-hidden border border-border bg-muted mb-4">
              <Image src={event.images[0]} alt={event.title} className="h-full w-full object-cover" />
            </div>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <PIcon className="h-4 w-4" /> {P.label} clearance event
          </span>
          <h1 className="text-3xl font-bold text-foreground mt-3">{event.title}</h1>
          {event.description && <p className="mt-3 text-muted-foreground leading-relaxed whitespace-pre-line">{event.description}</p>}
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1"><MapPin className="h-4 w-4" /> Location</div>
            <p className="font-medium text-foreground">{event.venue_name ? `${event.venue_name}, ` : ''}{event.suburb ? `${event.suburb}, ` : ''}{event.state || 'Australia'}</p>
            <p className="text-xs text-muted-foreground mt-1">{isOwner && event.address ? event.address : 'Full address shared with registered attendees.'}</p>
          </div>
          {event.event_start && (
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1"><Calendar className="h-4 w-4" /> When</div>
              <p className="font-medium text-foreground">
                {new Date(event.event_start).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
                {event.event_end ? ' — ' + new Date(event.event_end).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
              </p>
            </div>
          )}
          {event.inspection_times && event.inspection_times.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1"><Clock className="h-4 w-4" /> Inspection times</div>
              <ul className="space-y-1">
                {event.inspection_times.map((t, i) => (
                  <li key={i} className="text-foreground">{new Date(t).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</li>
                ))}
              </ul>
            </div>
          )}
          {event.collection_instructions && (
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <div className="text-muted-foreground mb-1">Collection</div>
              <p className="text-foreground whitespace-pre-line">{event.collection_instructions}</p>
            </div>
          )}
          {isOwner && <Link to={`/sell-garage-sale?edit=${event.id}`}><Button variant="outline" className="w-full"><Settings className="h-4 w-4 mr-1" /> Edit event</Button></Link>}
        </div>
      </div>

      <div className="mt-8">
        <LiveStreamPanel targetType="event" targetId={id} />
      </div>

      <div className="mt-8">
        <EventAttendancePanel eventId={id} isOwner={isOwner} />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Items in this sale</h2>
        {isOwner && (
          <Button onClick={() => setShowAdd((s) => !s)} variant={showAdd ? 'outline' : 'default'}>
            <PackagePlus className="h-4 w-4 mr-1" /> {showAdd ? 'Close' : 'Add item'}
          </Button>
        )}
      </div>

      {showAdd && isOwner && (
        <form onSubmit={addItem} className="mt-4 rounded-xl border border-border bg-card p-5 grid sm:grid-cols-2 gap-3">
          <input className="sm:col-span-2 h-10 rounded-md border border-input bg-background px-3" placeholder="Item title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="sm:col-span-2 rounded-md border border-input bg-background px-3 py-2" rows={2} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className="h-10 rounded-md border border-input bg-background px-3" placeholder="Starting bid ($)" type="number" value={form.starting_bid} onChange={(e) => setForm({ ...form, starting_bid: e.target.value })} />
          <input className="h-10 rounded-md border border-input bg-background px-3" placeholder="Reserve ($, optional)" type="number" value={form.reserve_price} onChange={(e) => setForm({ ...form, reserve_price: e.target.value })} />
          <input className="h-10 rounded-md border border-input bg-background px-3" placeholder="Min increment ($)" type="number" value={form.min_bid_increment} onChange={(e) => setForm({ ...form, min_bid_increment: e.target.value })} />
          <input className="h-10 rounded-md border border-input bg-background px-3" type="datetime-local" value={form.closing_time} onChange={(e) => setForm({ ...form, closing_time: e.target.value })} />
          <input className="sm:col-span-2 h-10 rounded-md border border-input bg-background px-3" placeholder="Image URL" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
          <select className="h-10 rounded-md border border-input bg-background px-3" value={form.bidding_type} onChange={(e) => setForm({ ...form, bidding_type: e.target.value })}>
            <option value="">Inherit from event</option>
            <option value="online">Online</option>
            <option value="physical">In-person</option>
            <option value="hybrid">Hybrid</option>
          </select>
          {err && <p className="sm:col-span-2 text-sm text-red-600">{err}</p>}
          <div className="sm:col-span-2"><Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add item'}</Button></div>
        </form>
      )}

      {itemsLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No items listed yet.{isOwner ? ' Add the first item.' : ''}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {items.map((a) => <AuctionCard key={a.id} auction={a} />)}
        </div>
      )}
    </div>
  );
}