/** Publication dates use one calendar across local previews and CI builds. */
export const siteTimeZone = 'Asia/Shanghai';

const fullDate = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: siteTimeZone,
});
const calendar = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  numberingSystem: 'latn',
  timeZone: siteTimeZone,
});

export const formatDate = (date: Date): string => fullDate.format(date);

export function calendarDate(date: Date): { year: number; month: string; day: string } {
  const parts = Object.fromEntries(
    calendar.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return { year: Number(parts.year), month: parts.month, day: parts.day };
}
