import type { WorkOrder } from '../types';

export function isArızaWorkOrder(order: Pick<WorkOrder, 'type' | 'category'>): boolean {
  const combined = `${order.type ?? ''} ${order.category ?? ''}`.toLocaleLowerCase('tr-TR');
  return combined.includes('arıza') || combined.includes('ariza');
}

/** API UTC zamanını Date'e çevirir ("yyyy-MM-dd HH:mm" UTC kabul edilir). */
export function parseWorkOrderDate(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();

  // Eski format: "yyyy-MM-dd HH:mm" → UTC
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(trimmed) && !trimmed.includes('T')) {
    const parsed = new Date(trimmed.replace(' ', 'T') + ':00Z');
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** UTC Date → Türkiye saati (Europe/Istanbul) metin. */
export function formatWorkOrderDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

export function formatApiDateTime(value?: string | null): string {
  const date = parseWorkOrderDate(value);
  return date ? formatWorkOrderDate(date) : '—';
}

export function durationMinutes(
  startedAt?: string | null,
  completedAt?: string | null,
): number | null {
  const start = parseWorkOrderDate(startedAt);
  const end = parseWorkOrderDate(completedAt);
  if (!start || !end) return null;
  const mins = Math.round((end.getTime() - start.getTime()) / 60_000);
  return mins < 0 ? 0 : mins;
}
