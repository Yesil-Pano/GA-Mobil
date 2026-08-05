import type { WorkOrder } from '../types';

export type WorkOrderCoords = { latitude: number; longitude: number };

function isValidCoords(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** API position alanını [lat, lng] olarak çözümler. */
export function parseWorkOrderCoords(
  order: Pick<WorkOrder, 'position'> & {
    latitude?: number | null;
    longitude?: number | null;
    lat?: number | null;
    lng?: number | null;
  },
): WorkOrderCoords | null {
  const pos = order.position as unknown;

  if (Array.isArray(pos) && pos.length >= 2) {
    const lat = Number(pos[0]);
    const lng = Number(pos[1]);
    if (isValidCoords(lat, lng)) return { latitude: lat, longitude: lng };
  }

  if (pos && typeof pos === 'object' && !Array.isArray(pos)) {
    const record = pos as Record<string, unknown>;
    const lat = Number(record.latitude ?? record.lat ?? record.y ?? record[0]);
    const lng = Number(record.longitude ?? record.lng ?? record.x ?? record[1]);
    if (isValidCoords(lat, lng)) return { latitude: lat, longitude: lng };
  }

  const lat = Number(order.latitude ?? order.lat);
  const lng = Number(order.longitude ?? order.lng);
  if (isValidCoords(lat, lng)) return { latitude: lat, longitude: lng };

  return null;
}
