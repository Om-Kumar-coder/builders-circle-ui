/**
 * Format a date string to a readable format
 * @param dateString ISO date string or null/undefined
 * @returns Formatted date (e.g., "Jan 15, 2024") or "Never" if null/undefined
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a date string to a long format
 * @param dateString ISO date string or null/undefined
 * @returns Formatted date (e.g., "January 15, 2024") or "Never" if null/undefined
 */
export function formatDateLong(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a date string to include time
 * @param dateString ISO datetime string or null/undefined
 * @returns Formatted datetime (e.g., "Jan 15, 2024, 3:30 PM") or "Never" if null/undefined
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Get relative time from now
 * @param dateString ISO datetime string or null/undefined
 * @returns Relative time (e.g., "2 hours ago", "in 3 days") or "Never" if null/undefined
 */
export function getRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  
  return formatDate(dateString);
}

/**
 * Check if a date is in the past
 * @param dateString ISO date string or null/undefined
 * @returns true if date is in the past, false if null/undefined
 */
export function isPast(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  return new Date(dateString) < new Date();
}

/**
 * Check if a date is in the future
 * @param dateString ISO date string or null/undefined
 * @returns true if date is in the future, false if null/undefined
 */
export function isFuture(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  return new Date(dateString) > new Date();
}

/**
 * Get days until a date
 * @param dateString ISO date string or null/undefined
 * @returns Number of days (negative if past), 0 if null/undefined
 */
export function daysUntil(dateString: string | null | undefined): number {
  if (!dateString) return 0;
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
