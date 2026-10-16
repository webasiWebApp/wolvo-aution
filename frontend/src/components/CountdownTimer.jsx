import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

function pad(n) {
  return String(n).padStart(2, '0');
}

function getRemaining(target) {
  const total = new Date(target).getTime() - Date.now();
  if (total <= 0) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, ended: true };
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((total / (1000 * 60)) % 60);
  const seconds = Math.floor((total / 1000) % 60);
  return { total, days, hours, minutes, seconds, ended: false };
}

export default function CountdownTimer({ closingTime, startLabel = "Starts in", endLabel = "Ends in", variant = "default" }) {
  const [remaining, setRemaining] = useState(() => getRemaining(closingTime));

  useEffect(() => {
    setRemaining(getRemaining(closingTime));
    const id = setInterval(() => setRemaining(getRemaining(closingTime)), 1000);
    return () => clearInterval(id);
  }, [closingTime]);

  if (remaining.ended) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1.5 font-medium",
        variant === "large" ? "text-base" : "text-sm",
        "text-muted-foreground"
      )}>
        <Clock className="w-4 h-4" /> Closed
      </span>
    );
  }

  const urgent = remaining.total < 1000 * 60 * 60 * 6; // under 6 hours

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 font-mono tabular-nums",
      variant === "large" ? "text-lg font-semibold" : "text-sm font-medium",
      urgent ? "text-red-600" : "text-emerald-700"
    )}>
      <Clock className={cn("w-4 h-4", urgent && "text-red-600")} />
      {remaining.days > 0 && <span>{remaining.days}d </span>}
      <span>{pad(remaining.hours)}:</span>
      <span>{pad(remaining.minutes)}:</span>
      <span>{pad(remaining.seconds)}</span>
    </span>
  );
}