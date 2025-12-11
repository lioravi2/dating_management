import { z } from 'zod';

// Partner Activity Types
export const PartnerActivityType = z.enum([
  'in-app_chat',
  'whatsapp',
  'phone',
  'actual_date',
  'other',
]);

export type PartnerActivityType = z.infer<typeof PartnerActivityType>;

// Account Types
export const AccountType = z.enum(['free', 'pro']);
export type AccountType = z.infer<typeof AccountType>;

// Subscription Status
export const SubscriptionStatus = z.enum([
  'active',
  'canceled',
  'past_due',
  'trialing',
  'incomplete',
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatus>;

// Database Types
export interface User {
  id: string;
  email: string | null;
  full_name: string | null;
  account_type: AccountType;
  created_at: string;
  updated_at: string;
}

export interface Partner {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  description: string | null;
  description_time: string | null;
  facebook_profile: string | null;
  x_profile: string | null;
  linkedin_profile: string | null;
  instagram_profile: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerPhoto {
  id: string;
  partner_id: string;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

export interface PartnerActivity {
  id: string;
  partner_id: string;
  start_time: string;
  end_time: string | null;
  type: PartnerActivityType;
  location: string | null;
  description: string | null;
  google_calendar_event_id: string | null;
  created_at: string;
  updated_at: string;
}

// Keep PartnerNote as alias for backward compatibility during migration
export type PartnerNote = PartnerActivity;
export type PartnerNoteType = PartnerActivityType;

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: SubscriptionStatus;
  plan_type: 'pro';
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

// Validation Schemas
export const PartnerSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone_number: z.string().optional(),
  description: z.string().optional(),
  facebook_profile: z.string().url().optional().or(z.literal('')),
  x_profile: z.string().url().optional().or(z.literal('')),
  linkedin_profile: z.string().url().optional().or(z.literal('')),
  instagram_profile: z.string().url().optional().or(z.literal('')),
});

export const PartnerActivitySchema = z.object({
  partner_id: z.string().uuid(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime().optional(),
  type: PartnerActivityType,
  location: z.string().optional(),
  description: z.string().optional(),
});

// Keep PartnerNoteSchema as alias for backward compatibility
export const PartnerNoteSchema = PartnerActivitySchema;

// Constants
export const FREE_TIER_ACTIVITY_LIMIT = 20;
export const FREE_TIER_NOTE_LIMIT = FREE_TIER_ACTIVITY_LIMIT; // Backward compatibility

