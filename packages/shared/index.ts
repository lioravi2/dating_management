import { z } from 'zod';

// Partner Note Types
export const PartnerNoteType = z.enum([
  'in-app_chat',
  'whatsapp',
  'phone',
  'actual_date',
  'other',
]);

export type PartnerNoteType = z.infer<typeof PartnerNoteType>;

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
  internal_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  description: string | null;
  description_time: string | null;
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

export interface PartnerNote {
  id: string;
  partner_id: string;
  start_time: string;
  end_time: string | null;
  type: PartnerNoteType;
  location: string | null;
  description: string | null;
  google_calendar_event_id: string | null;
  created_at: string;
  updated_at: string;
}

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
  internal_id: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone_number: z.string().optional(),
  description: z.string().optional(),
  description_time: z.string().optional(),
});

export const PartnerNoteSchema = z.object({
  partner_id: z.string().uuid(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime().optional(),
  type: PartnerNoteType,
  location: z.string().optional(),
  description: z.string().optional(),
});

// Constants
export const FREE_TIER_NOTE_LIMIT = 20;

