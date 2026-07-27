/** İstasyon / nokta durumları (web ile aynı) */
export const STATION_STATUS = {
  IN_MAINTENANCE: 'Bakıma Dahil',
  OUT_OF_MAINTENANCE: 'Bakım Dışı',
} as const;

export function stationStatusColor(status: string | null | undefined): string {
  if (status === STATION_STATUS.OUT_OF_MAINTENANCE) return '#EF4444';
  return '#22C55E';
}

/** Firma adından TESLA eşlemesi (eski Unilever/Algida dahil) */
export function isTeslaCompany(name: string | null | undefined): boolean {
  const hay = (name ?? '').toLocaleLowerCase('tr-TR');
  return ['tesla', 'unilever', 'algida'].some((t) => hay.includes(t));
}
