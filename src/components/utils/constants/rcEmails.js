/**
 * RC (admin) email addresses used for permission checks.
 * Centralised so they only need to be updated in one place.
 */
export const RC_EMAILS = ['bv2hh128@gmail.com', 'bv2hh128@hotmail.com'];

/**
 * Check whether the given email belongs to an RC admin.
 */
export function isRCEmail(email) {
  return RC_EMAILS.includes(email);
}
