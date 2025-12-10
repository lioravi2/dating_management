import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    
    if (!publishableKey) {
      console.warn('Stripe publishable key not found.');
      return Promise.resolve(null);
    }
    
    // Validate key format (should start with pk_test_ or pk_live_)
    if (!publishableKey.startsWith('pk_test_') && !publishableKey.startsWith('pk_live_')) {
      console.error('Invalid Stripe publishable key format. Key should start with pk_test_ or pk_live_');
      return Promise.resolve(null);
    }
    
    stripePromise = loadStripe(publishableKey, {
      locale: 'en',
    });
  }
  
  return stripePromise;
};

