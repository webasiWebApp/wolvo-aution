import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus, Search, Shield, User as UserIcon } from 'lucide-react';

export default function AdminAccounts() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      return Array.isArray(users) ? users : (users.items || []);
    }
  });

  const filtered = search
    ? users.filter((u) => (u.email || '').toLowerCase().includes(search.toLowerCase()) || (u.full_name || '').toLowerCase().includes(search.toLowerCase()))
    : users;

  const invite = async (e) => {
    e.preventDefault();
    setMsg(''); setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole);
      setMsg(`Invitation sent to ${inviteEmail}.`);
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err) {
      setMsg(err.message || 'Failed to send invitation.');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-1">Accounts</h1>
      <p className="text-sm text-muted-foreground mb-6">View registered users and invite buyers, sellers or administrators.</p>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2"><UserPlus className="h-4 w-4" /> Invite a user</h2>
          <form onSubmit={invite} className="space-y-3">
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email address" required className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="user">User (buyer / seller)</option>
              <option value="admin">Administrator</option>
            </select>
            <Button type="submit" disabled={inviting} className="w-full">{inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send invitation'}</Button>
            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
          </form>
          <p className="text-xs text-muted-foreground mt-3">
            Role architecture supports buyers, sellers, auctioneers and administrators. The built-in role is "user" (buyer/seller) or "admin". Finer roles can be added as the platform grows.
          </p>
        </div>

        <div className="lg:col-span-2">
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" className="w-full pl-9 pr-3 h-10 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-foreground">{u.full_name || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {u.role === 'admin' ? <Shield className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />} {u.role || 'user'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No users found.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}