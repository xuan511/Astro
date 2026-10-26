export type ReadingSize = 'small' | 'normal' | 'large';
export interface ReadingPreferences {
  size: ReadingSize;
  wide: boolean;
}
export const readingSizes: ReadingSize[] = ['small', 'normal', 'large'];
export function readingPreferences(value: unknown): ReadingPreferences {
  const data = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    size: readingSizes.includes(data.size as ReadingSize) ? (data.size as ReadingSize) : 'normal',
    wide: data.wide === true,
  };
}
export function changeReadingSize(
  preferences: ReadingPreferences,
  direction: number,
): ReadingPreferences {
  const index = readingSizes.indexOf(preferences.size);
  return {
    ...preferences,
    size: readingSizes[Math.max(0, Math.min(readingSizes.length - 1, index + direction))],
  };
}
