export const PHOTO_CATEGORY_ISG = 'ISG' as const;
export const PHOTO_CATEGORY_OPERASYON = 'OPERASYON' as const;

export type PhotoCategory = typeof PHOTO_CATEGORY_ISG | typeof PHOTO_CATEGORY_OPERASYON;

export const PHOTO_LIMITS: Record<PhotoCategory, number> = {
  [PHOTO_CATEGORY_ISG]: 10,
  [PHOTO_CATEGORY_OPERASYON]: 30,
};

export function normalizePhotoCategory(description?: string | null): PhotoCategory | null {
  const value = (description ?? '').trim().toUpperCase();
  if (value === PHOTO_CATEGORY_ISG) return PHOTO_CATEGORY_ISG;
  if (value === PHOTO_CATEGORY_OPERASYON) return PHOTO_CATEGORY_OPERASYON;
  return null;
}
