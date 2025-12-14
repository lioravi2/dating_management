import Stripe from 'stripe';

/**
 * Extracts price amount and billing interval from a Stripe subscription
 * @param subscription - Stripe subscription object
 * @returns Object with price_amount (in cents) and billing_interval ('day', 'month', or 'year')
 */
export function extractSubscriptionPrice(
  subscription: Stripe.Subscription
): { price_amount: number | null; billing_interval: 'day' | 'month' | 'year' | null } {
  // Get the first price item from the subscription
  const priceItem = subscription.items.data[0];
  
  if (!priceItem || !priceItem.price) {
    return { price_amount: null, billing_interval: null };
  }

  const price = priceItem.price;
  const amount = price.unit_amount || 0;
  const interval = price.recurring?.interval;

  // Map Stripe interval to our database values
  let billingInterval: 'day' | 'month' | 'year' | null = null;
  if (interval === 'day') {
    billingInterval = 'day';
  } else if (interval === 'month') {
    billingInterval = 'month';
  } else if (interval === 'year') {
    billingInterval = 'year';
  }

  return {
    price_amount: amount,
    billing_interval: billingInterval,
  };
}



