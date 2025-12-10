/**
 * Pricing Configuration
 * 
 * Centralized pricing constants for easy updates
 */

// Pro subscription monthly price in cents (999 = $9.99)
export const PRO_MONTHLY_PRICE = 999;

// Free tier partner limit (not used in current phase, but defined for future)
export const FREE_TIER_PARTNER_LIMIT = 10;

// Helper function to format price for display
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Helper function to get monthly price display
export function getMonthlyPriceDisplay(): string {
  return formatPrice(PRO_MONTHLY_PRICE);
}


