/**
 * Stripe Integration Module
 * 
 * Handles:
 * - Subscription management
 * - Webhook processing
 * - Customer management
 * 
 * In production, this would integrate with Stripe API
 */

export interface StripeCustomer {
  id: string;
  email: string;
  stripeCustomerId: string;
  subscription?: {
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'past_due' | 'cancelled';
    currentPeriodEnd: number;
  };
}

export interface StripeWebhookEvent {
  type: string;
  data: {
    object: Record<string, any>;
  };
}

// In-memory customers store (use database in production)
const customersStore = new Map<string, StripeCustomer>();

/**
 * Create or get Stripe customer
 */
export async function createOrGetCustomer(
  userId: string,
  email: string
): Promise<StripeCustomer> {
  let customer = customersStore.get(userId);

  if (!customer) {
    // In production: call Stripe API to create customer
    customer = {
      id: userId,
      email,
      stripeCustomerId: `cus_${Math.random().toString(36).slice(2, 9)}`,
    };

    customersStore.set(userId, customer);
  }

  return customer;
}

/**
 * Create subscription
 */
export async function createSubscription(
  userId: string,
  plan: 'pro' | 'enterprise',
  paymentMethodId: string
) {
  const customer = customersStore.get(userId);

  if (!customer) {
    throw new Error('Customer not found');
  }

  // In production: call Stripe API to create subscription
  const subscriptionId = `sub_${Math.random().toString(36).slice(2, 9)}`;

  customer.subscription = {
    plan,
    status: 'active',
    currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };

  customersStore.set(userId, customer);

  return {
    subscriptionId,
    status: 'success',
    message: `Subscription to ${plan} plan created successfully`,
  };
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(userId: string) {
  const customer = customersStore.get(userId);

  if (!customer || !customer.subscription) {
    throw new Error('No active subscription');
  }

  customer.subscription.status = 'cancelled';
  customersStore.set(userId, customer);

  return {
    status: 'success',
    message: 'Subscription cancelled',
  };
}

/**
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(event: StripeWebhookEvent) {
  console.log('[STRIPE] Webhook event:', event.type);

  switch (event.type) {
    case 'invoice.payment_succeeded': {
      // Upgrade user plan or add credits
      const customerId = event.data.object.customer;
      const userId = Array.from(customersStore.entries()).find(
        ([_, customer]) => customer.stripeCustomerId === customerId
      )?.[0];

      if (userId) {
        console.log('[STRIPE] Payment succeeded for user:', userId);
        // Mark subscription as active
      }
      break;
    }

    case 'invoice.payment_failed': {
      // Mark subscription as past due
      const customerId = event.data.object.customer;
      const userId = Array.from(customersStore.entries()).find(
        ([_, customer]) => customer.stripeCustomerId === customerId
      )?.[0];

      if (userId) {
        const customer = customersStore.get(userId);
        if (customer && customer.subscription) {
          customer.subscription.status = 'past_due';
          customersStore.set(userId, customer);
        }
        console.log('[STRIPE] Payment failed for user:', userId);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      // Cancel user's subscription
      const customerId = event.data.object.customer;
      const userId = Array.from(customersStore.entries()).find(
        ([_, customer]) => customer.stripeCustomerId === customerId
      )?.[0];

      if (userId) {
        const customer = customersStore.get(userId);
        if (customer && customer.subscription) {
          customer.subscription.status = 'cancelled';
          customersStore.set(userId, customer);
        }
        console.log('[STRIPE] Subscription cancelled for user:', userId);
      }
      break;
    }

    default:
      console.log('[STRIPE] Unhandled webhook event:', event.type);
  }
}

/**
 * Verify Stripe webhook signature
 * In production, use Stripe SDK
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) {
    return false;
  }

  // In production: use Stripe SDK
  // import Stripe from 'stripe';
  // const stripe = new Stripe(secret);
  // return stripe.webhooks.constructEvent(payload, signature, secret);

  // For demo: accept if signature provided
  return true;
}

/**
 * Get customer details
 */
export async function getCustomer(userId: string): Promise<StripeCustomer | null> {
  return customersStore.get(userId) || null;
}

/**
 * Get all customers (admin)
 */
export async function getAllCustomers(): Promise<StripeCustomer[]> {
  return Array.from(customersStore.values());
}
