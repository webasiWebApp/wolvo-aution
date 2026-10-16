import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Mail, Phone, MapPin, Loader2, CheckCircle2 } from 'lucide-react';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.message) { setError('Please fill in your name, email and message.'); return; }
    setSubmitting(true);
    try {
      await base44.entities.ContactMessage.create(form);
      setSubmitted(true);
      setForm({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Contact us</h1>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          Questions about a listing, a bid, or selling on the marketplace? Send us a message and our team will get back to you.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="space-y-5">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Email</h3>
              <p className="text-sm text-muted-foreground">support@perthauction.example</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Phone</h3>
              <p className="text-sm text-muted-foreground">(08) 0000 0000</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Location</h3>
              <p className="text-sm text-muted-foreground">Australia-wide</p>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          {submitted ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600 mb-3" />
              <h3 className="font-semibold text-emerald-900">Message sent</h3>
              <p className="text-sm text-emerald-900/80 mt-1">Thanks for reaching out. We'll respond to your message shortly.</p>
              <Button variant="outline" className="mt-4" onClick={() => setSubmitted(false)}>Send another message</Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Name *</label>
                  <input value={form.name} onChange={set('name')} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Email *</label>
                  <input type="email" value={form.email} onChange={set('email')} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Phone</label>
                  <input value={form.phone} onChange={set('phone')} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Subject</label>
                  <input value={form.subject} onChange={set('subject')} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Message *</label>
                <textarea value={form.message} onChange={set('message')} rows={5} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {submitting ? 'Sending…' : 'Send message'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}