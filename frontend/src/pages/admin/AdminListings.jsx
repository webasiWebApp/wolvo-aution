import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Pencil, Trash2, X, Search } from 'lucide-react';

const EMPTY = {
  title: '', description: '', category: '', condition: 'Used - Good',
  suburb: '', state: 'WA', lot_number: '', starting_bid: '', min_bid_increment: '10',
  reserve_price: '', status: 'upcoming', bidding_type: 'online',
  start_time: '', closing_time: '', image_url: '', featured: false, is_sample: true,
  viewing_notes: '',
  physical_date: '', expected_duration_minutes: '120', registration_deadline: '',
  min_confirmed_attendees: '0', max_venue_capacity: '0', attendance_requires_approval: false,
  online_bidding_enabled: true, inspections_available: false, auctioneer_id: ''
};

const CONDITIONS = ["New", "Used - Like New", "Used - Good", "Used - Fair", "For Parts or Repair", "Antique / Collectable"];

export default function AdminListings() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // auction record or EMPTY for new
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: auctions = [], isLoading } = useQuery({
    queryKey: ['admin-listings', search],
    queryFn: async () => {
      const query = search ? { title: { $regex: search, $options: 'i' } } : {};
      const page = await base44.entities.Auction.filter(query, { sort: '-created_date', limit: 100 });
      return page.items || [];
    }
  });

  const openNew = () => { setEditing({ ...EMPTY }); setShowForm(true); setError(''); };
  const openEdit = (a) => {
    setEditing({
      ...a,
      starting_bid: String(a.starting_bid ?? ''),
      min_bid_increment: String(a.min_bid_increment ?? '10'),
      reserve_price: a.reserve_price != null ? String(a.reserve_price) : '',
      start_time: a.start_time ? a.start_time.slice(0, 16) : '',
      closing_time: a.closing_time ? a.closing_time.slice(0, 16) : '',
      physical_date: a.physical_date ? a.physical_date.slice(0, 16) : '',
      registration_deadline: a.registration_deadline ? a.registration_deadline.slice(0, 16) : '',
      expected_duration_minutes: String(a.expected_duration_minutes ?? '120'),
      min_confirmed_attendees: String(a.min_confirmed_attendees ?? '0'),
      max_venue_capacity: String(a.max_venue_capacity ?? '0'),
      attendance_requires_approval: !!a.attendance_requires_approval,
      online_bidding_enabled: a.online_bidding_enabled !== false,
      inspections_available: !!a.inspections_available,
      auctioneer_id: a.auctioneer_id || ''
    });
    setShowForm(true); setError('');
  };

  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setEditing({ ...editing, [k]: val });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = {
        ...editing,
        starting_bid: Number(editing.starting_bid) || 0,
        min_bid_increment: Number(editing.min_bid_increment) || 0,
        reserve_price: editing.reserve_price ? Number(editing.reserve_price) : undefined,
        current_highest_bid: editing.current_highest_bid != null ? editing.current_highest_bid : (Number(editing.starting_bid) || 0),
        expected_duration_minutes: Number(editing.expected_duration_minutes) || 0,
        min_confirmed_attendees: Number(editing.min_confirmed_attendees) || 0,
        max_venue_capacity: Number(editing.max_venue_capacity) || 0,
        online_bidding_enabled: editing.bidding_type === 'online' ? true : editing.bidding_type === 'physical' ? false : editing.online_bidding_enabled !== false
      };
      if (editing.id) {
        await base44.entities.Auction.update(editing.id, payload);
      } else {
        await base44.entities.Auction.create(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      queryClient.invalidateQueries({ queryKey: ['auctions'] });
      setShowForm(false); setEditing(null);
    } catch (err) {
      setError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a) => {
    if (!confirm(`Delete "${a.title}"? This cannot be undone.`)) return;
    await base44.entities.Auction.delete(a.id);
    queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
    queryClient.invalidateQueries({ queryKey: ['auctions'] });
  };

  const inputCls = "w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const labelCls = "text-sm font-medium text-foreground";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Listings</h1>
          <p className="text-sm text-muted-foreground">Create, edit and remove auction listings.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1.5" /> New listing</Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search listings" className="w-full pl-9 pr-3 h-10 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Current bid</th>
                <th className="px-4 py-3">Bids</th>
                <th className="px-4 py-3">Format</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {auctions.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{a.title}</span>
                      {a.is_sample && <span className="text-[10px] font-bold uppercase bg-black/70 text-white px-1.5 py-0.5 rounded">Sample</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{a.suburb}, {a.state}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.status === 'open' ? 'bg-emerald-100 text-emerald-700' : a.status === 'upcoming' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{a.status}</span>
                  </td>
                  <td className="px-4 py-3">${(a.current_highest_bid || a.starting_bid || 0).toLocaleString('en-AU')}</td>
                  <td className="px-4 py-3">{a.bid_count || 0}</td>
                  <td className="px-4 py-3 capitalize">{a.bidding_type}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(a)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(a)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {auctions.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No listings found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="bg-card rounded-xl border border-border w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">{editing.id ? 'Edit listing' : 'New listing'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={save} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className={labelCls}>Title *</label>
                <input value={editing.title} onChange={set('title')} required className={`mt-1 ${inputCls}`} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea value={editing.description} onChange={set('description')} rows={3} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Category</label>
                  <input value={editing.category} onChange={set('category')} className={`mt-1 ${inputCls}`} />
                </div>
                <div>
                  <label className={labelCls}>Condition</label>
                  <select value={editing.condition} onChange={set('condition')} className={`mt-1 ${inputCls}`}>
                    {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Suburb</label>
                  <input value={editing.suburb} onChange={set('suburb')} className={`mt-1 ${inputCls}`} />
                </div>
                <div>
                  <label className={labelCls}>State</label>
                  <select value={editing.state} onChange={set('state')} className={`mt-1 ${inputCls}`}>
                    {['WA','NSW','VIC','QLD','SA','TAS','NT','ACT'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Starting bid *</label>
                  <input type="number" value={editing.starting_bid} onChange={set('starting_bid')} required className={`mt-1 ${inputCls}`} />
                </div>
                <div>
                  <label className={labelCls}>Min increment</label>
                  <input type="number" value={editing.min_bid_increment} onChange={set('min_bid_increment')} className={`mt-1 ${inputCls}`} />
                </div>
                <div>
                  <label className={labelCls}>Reserve price</label>
                  <input type="number" value={editing.reserve_price} onChange={set('reserve_price')} className={`mt-1 ${inputCls}`} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Status</label>
                  <select value={editing.status} onChange={set('status')} className={`mt-1 ${inputCls}`}>
                    <option value="upcoming">Upcoming</option>
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Bidding format</label>
                  <select value={editing.bidding_type} onChange={set('bidding_type')} className={`mt-1 ${inputCls}`}>
                    <option value="online">Online</option>
                    <option value="physical">Physical</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
                </div>
                {editing.bidding_type !== 'online' && (
                <div className="rounded-lg border border-border p-4 space-y-4 bg-muted/20">
                  <p className="text-sm font-semibold text-foreground">Physical auction details</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Physical auction date & start time</label>
                      <input type="datetime-local" value={editing.physical_date} onChange={set('physical_date')} className={`mt-1 ${inputCls}`} />
                    </div>
                    <div>
                      <label className={labelCls}>Expected duration (minutes)</label>
                      <input type="number" value={editing.expected_duration_minutes} onChange={set('expected_duration_minutes')} className={`mt-1 ${inputCls}`} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Registration deadline</label>
                      <input type="datetime-local" value={editing.registration_deadline} onChange={set('registration_deadline')} className={`mt-1 ${inputCls}`} />
                    </div>
                    <div>
                      <label className={labelCls}>Assigned auctioneer (user id or email)</label>
                      <input value={editing.auctioneer_id} onChange={set('auctioneer_id')} placeholder="user id" className={`mt-1 ${inputCls}`} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Minimum confirmed attendees</label>
                      <input type="number" value={editing.min_confirmed_attendees} onChange={set('min_confirmed_attendees')} className={`mt-1 ${inputCls}`} />
                    </div>
                    <div>
                      <label className={labelCls}>Maximum venue capacity</label>
                      <input type="number" value={editing.max_venue_capacity} onChange={set('max_venue_capacity')} className={`mt-1 ${inputCls}`} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-5">
                    <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={!!editing.attendance_requires_approval} onChange={set('attendance_requires_approval')} /> Attendance requires approval</label>
                    {editing.bidding_type === 'hybrid' && (
                      <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={!!editing.online_bidding_enabled} onChange={set('online_bidding_enabled')} /> Online bidding enabled</label>
                    )}
                    <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={!!editing.inspections_available} onChange={set('inspections_available')} /> Inspections available</label>
                  </div>
                </div>
                )}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Start time</label>
                  <input type="datetime-local" value={editing.start_time} onChange={set('start_time')} className={`mt-1 ${inputCls}`} />
                </div>
                <div>
                  <label className={labelCls}>Closing time *</label>
                  <input type="datetime-local" value={editing.closing_time} onChange={set('closing_time')} required className={`mt-1 ${inputCls}`} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Image URL</label>
                <input value={editing.image_url} onChange={set('image_url')} placeholder="https://..." className={`mt-1 ${inputCls}`} />
              </div>
              <div>
                <label className={labelCls}>Viewing notes</label>
                <input value={editing.viewing_notes} onChange={set('viewing_notes')} className={`mt-1 ${inputCls}`} />
              </div>
              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={!!editing.featured} onChange={set('featured')} /> Featured listing</label>
                <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={!!editing.is_sample} onChange={set('is_sample')} /> Mark as sample data</label>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editing.id ? 'Save changes' : 'Create listing'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}