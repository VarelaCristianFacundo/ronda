'use client';

import { whatsappHref } from '@/components/invite-share';

export function ReminderButton({ text, label }: { text: string; label: string }) {
  return (
    <a href={whatsappHref(text)} target="_blank" rel="noreferrer" className="btn btn-secondary btn-block">
      {label}
    </a>
  );
}
