import type { WorkOrder } from '../types';

export function isArızaWorkOrder(order: Pick<WorkOrder, 'type' | 'category'>): boolean {
  const combined = `${order.type ?? ''} ${order.category ?? ''}`.toLocaleLowerCase('tr-TR');
  return combined.includes('arıza') || combined.includes('ariza');
}

export function parseWorkOrderDate(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const normalized = value.trim().replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatWorkOrderDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
