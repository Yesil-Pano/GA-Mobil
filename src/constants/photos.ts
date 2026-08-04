export const PHOTO_CATEGORY_ISG = 'ISG' as const;
export const PHOTO_CATEGORY_OPERASYON = 'OPERASYON' as const;
export const PHOTO_CATEGORY_ACILIS = 'ACILIS' as const;

export type PhotoCategory = typeof PHOTO_CATEGORY_ISG | typeof PHOTO_CATEGORY_OPERASYON;

export const PHOTO_LIMITS: Record<PhotoCategory, number> = {
  [PHOTO_CATEGORY_ISG]: 10,
  [PHOTO_CATEGORY_OPERASYON]: 30,
};

const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

export function isVideoContentType(contentType?: string | null): boolean {
  return VIDEO_TYPES.has((contentType ?? '').toLowerCase());
}

export function normalizePhotoCategory(description?: string | null): PhotoCategory | null {
  const value = (description ?? '').trim().toUpperCase();
  if (value === PHOTO_CATEGORY_ISG) return PHOTO_CATEGORY_ISG;
  if (value === PHOTO_CATEGORY_OPERASYON) return PHOTO_CATEGORY_OPERASYON;
  return null;
}

export function isOpeningAttachment(description?: string | null): boolean {
  return (description ?? '').trim().toUpperCase() === PHOTO_CATEGORY_ACILIS;
}
