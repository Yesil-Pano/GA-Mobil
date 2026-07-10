import * as SecureStore from 'expo-secure-store';
import type { WorkOrder } from '../types';

export async function getCurrentUserId(): Promise<string | null> {
  const id = await SecureStore.getItemAsync('user_id');
  return id?.trim() || null;
}

/** Oturum açan kullanıcıya atanmış iş emirlerini döndürür. */
export function filterWorkOrdersForUser(
  orders: WorkOrder[] | null | undefined,
  userId: string | null,
): WorkOrder[] {
  if (!Array.isArray(orders)) return [];
  if (!userId) return [];

  const normalized = normalizeUserId(userId);
  return orders.filter((order) => normalizeUserId(order.assignedToUserId) === normalized);
}

function normalizeUserId(id: string | null | undefined): string {
  return (id ?? '').trim().replace(/[{}]/g, '').toLowerCase();
}

export { normalizeUserId };

export function extractApiErrorMessage(err: unknown, fallback: string): string {
  const safeFallback = fallback.trim() || 'Beklenmeyen bir hata oluştu.';
  const error = err as {
    message?: string;
    response?: { status?: number; data?: unknown };
  };

  if (!error.response) {
    const network = error.message?.trim();
    return network ? `${safeFallback}\n\n${network}` : safeFallback;
  }

  const { status, data } = error.response;
  const parts: string[] = [];

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const record = data as Record<string, unknown>;
    for (const key of ['message', 'Message', 'title', 'detail', 'Detail']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        parts.push(value.trim());
      }
    }
  } else if (typeof data === 'string' && data.trim()) {
    const snippet = data.trim().slice(0, 180);
    if (snippet) parts.push(snippet);
  }

  if (status === 401) {
    parts.unshift('Oturum süreniz dolmuş olabilir. Lütfen tekrar giriş yapın.');
  }

  if (parts.length > 0) {
    return parts.join('\n\n');
  }

  return status ? `${safeFallback} (HTTP ${status})` : safeFallback;
}

export function ensureAlertMessage(message: string, fallback: string): string {
  const trimmed = message.trim();
  return trimmed || fallback;
}
