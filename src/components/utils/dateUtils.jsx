import { format as dateFnsFormat } from 'date-fns';

/**
 * Convert UTC date to Taiwan time (UTC+8)
 */
export function toTaiwanTime(date) {
  const utcDate = new Date(date);
  return new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
}

/**
 * Format date in Taiwan timezone
 */
export function formatTaiwanTime(date, formatStr) {
  const taiwanDate = toTaiwanTime(date);
  return dateFnsFormat(taiwanDate, formatStr);
}

/**
 * Get current time in Taiwan timezone
 */
export function getTaiwanNow() {
  const now = new Date();
  return new Date(now.getTime() + 8 * 60 * 60 * 1000);
}