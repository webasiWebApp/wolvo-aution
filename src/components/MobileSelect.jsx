import React, { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A native-style mobile select trigger. On desktop it renders the native
 * <select> (fast, accessible). On mobile it renders a styled trigger button
 * that opens a bottom-sheet overlay listing the options — avoiding the
 * browser's default dropdown which looks unpolished inside a WebView.
 *
 * Props: value, onChange(value), placeholder, options: [{value,label}], className
 */
export default function MobileSelect({ value, onChange, placeholder = 'Select…', options = [], className }) {
  const [open, setOpen] = useState(false);

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        'flex items-center justify-between gap-2 h-9 rounded-md border border-input bg-background px-3 text-sm text-left w-full select-none',
        className
      )}
    >
      <span className={cn('truncate', !value && 'text-muted-foreground')}>
        {value ? (options.find((o) => o.value === value)?.label || value) : placeholder}
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );

  // Hidden native select for desktop + accessibility/form submission.
  return (
    <>
      <div className="hidden sm:block w-full">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-full"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="sm:hidden w-full">{trigger}</div>

      {open && (
        <div className="sm:hidden fixed inset-0 z-50 flex items-end justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-2xl bg-card rounded-t-2xl border-t border-border shadow-xl animate-in slide-in-from-bottom"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-medium text-foreground">{placeholder}</span>
              <button onClick={() => setOpen(false)} className="text-sm text-muted-foreground">Close</button>
            </div>
            <ul className="max-h-72 overflow-y-auto py-1">
              <li>
                <button
                  onClick={() => { onChange(''); setOpen(false); }}
                  className="flex items-center justify-between w-full px-4 py-3 text-sm text-left text-foreground hover:bg-muted"
                >
                  <span>{placeholder}</span>
                  {!value && <Check className="h-4 w-4 text-accent" />}
                </button>
              </li>
              {options.map((o) => (
                <li key={o.value}>
                  <button
                    onClick={() => { onChange(o.value); setOpen(false); }}
                    className="flex items-center justify-between w-full px-4 py-3 text-sm text-left text-foreground hover:bg-muted"
                  >
                    <span>{o.label}</span>
                    {value === o.value && <Check className="h-4 w-4 text-accent" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}