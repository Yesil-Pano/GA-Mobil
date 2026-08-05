import type { WorkOrder } from '../types';
import { filterWorkOrdersForUser } from './workOrders';

const TR_TIMEZONE = 'Europe/Istanbul';

export function isArızaWorkOrder(order: Pick<WorkOrder, 'type' | 'category'>): boolean {
  const combined = `${order.type ?? ''} ${order.category ?? ''}`.toLocaleLowerCase('tr-TR');
  return combined.includes('arıza') || combined.includes('ariza');
}

/** API'den gelen durumu mobilde olduğu gibi göster. */
export function displayWorkOrderStatus(status?: string | null): string {
  const s = (status ?? '').trim();
  if (!s) return 'Bekliyor';
  return s;
}

export function isWorkOrderFinished(status?: string | null): boolean {
  const s = (status ?? '').trim();
  return s === 'Tamamlandı' || s === 'İptal' || s === 'İptal Edildi';
}

/** Saha henüz işe başlamadıysa İşe Başla göster (Bekliyor veya yanlış Devam Ediyor / Atanmamış kaydı). */
export function canShowStartWorkOrder(
  order: Pick<WorkOrder, 'status' | 'startedAt' | 'assignedToUserId'>,
): boolean {
  if (isWorkOrderFinished(order.status)) return false;
  const status = displayWorkOrderStatus(order.status);
  if (status === 'Bekliyor') return true;
  if (status === 'Atanmamış' && order.assignedToUserId) return true;
  if (status === 'Devam Ediyor' && !order.startedAt?.trim()) return true;
  return false;
}

/** Tamamla / İptal yalnızca saha gerçekten başladıktan sonra. */
export function shouldShowInProgressActions(order: Pick<WorkOrder, 'status' | 'startedAt'>): boolean {
  const status = displayWorkOrderStatus(order.status);
  return status === 'Devam Ediyor' && !!order.startedAt?.trim();
}

function getTurkeyYearMonth(date: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TR_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === 'year')?.value ?? '0');
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? '0');
  return { year, month };
}

/** StartDate bulunulan Türkiye takvim ayında mı? */
export function isInCurrentTurkeyMonth(
  order: Pick<WorkOrder, 'startDate'>,
  now: Date = new Date(),
): boolean {
  const start = parseWorkOrderDate(order.startDate);
  if (!start) return true;

  const orderYm = getTurkeyYearMonth(start);
  const nowYm = getTurkeyYearMonth(now);
  return orderYm.year === nowYm.year && orderYm.month === nowYm.month;
}

/**
 * Mobil liste görünürlüğü:
 * - Tamamlanan/iptal: süresiz
 * - Arıza (aktif): her zaman
 * - Diğerleri: yalnızca bulunulan ay (StartDate)
 */
export function isVisibleOnMobileList(
  order: Pick<WorkOrder, 'status' | 'startDate' | 'endDate' | 'type' | 'category'>,
  now: Date = new Date(),
): boolean {
  if (isWorkOrderFinished(order.status)) return true;
  if (isArızaWorkOrder(order)) return true;
  return isInCurrentTurkeyMonth(order, now);
}

/**
 * Mobil liste: atanmış + görünürlük kuralları.
 * Periyodik şablon satırını, aktif alt dönem varken gizler.
 */
export function filterMobileVisibleWorkOrders(
  orders: WorkOrder[] | null | undefined,
  userId: string | null,
): WorkOrder[] {
  const mine = filterWorkOrdersForUser(orders, userId);
  const now = new Date();
  const active = mine.filter((o) => isVisibleOnMobileList(o, now));

  const parentIdsWithActiveChild = new Set(
    active
      .filter((o) => o.parentWorkOrderId)
      .map((o) => o.parentWorkOrderId as string),
  );

  return active.filter((o) => {
    if (o.isPeriodic && !o.parentWorkOrderId && parentIdsWithActiveChild.has(o.id)) {
      return false;
    }
    return true;
  });
}

/** API UTC zamanını Date'e çevirir (yyyy-MM-dd HH:mm UTC). */
export function parseWorkOrderDate(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(trimmed) && !trimmed.includes('T')) {
    const parsed = new Date(trimmed.replace(' ', 'T') + ':00Z');
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (/^\d{2}\.\d{2}\.\d{4}/.test(trimmed)) {
    const [datePart, timePart = '00:00'] = trimmed.split(' ');
    const [day, month, year] = datePart.split('.');
    const [hour, minute] = timePart.split(':');
    const parsed = new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    ));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** UTC Date → Türkiye saati metin → 01.09.2026 00:00 */
export function formatWorkOrderDate(date: Date): string {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: TR_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Yalnızca tarih → 01.09.2026 */
export function formatWorkOrderDateOnly(date: Date): string {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: TR_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
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
