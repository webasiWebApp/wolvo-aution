import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

// Hides most of an email address (jo••••@example.com) so it is safe to show publicly.
export function maskEmail(value) {
  return String(value || '').replace(/(.{2}).+(@.+)/, '$1••••$2');
}

// Public label for a bidder: emails are masked and names reduced to a first
// name plus last initial, so a bidder's full (often legal) name is never shown
// to other users.
export function maskBidderName(value) {
  if (!value) return 'Anonymous';
  if (value.includes('@')) return maskEmail(value);
  const parts = value.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}
