import { NextRequest, NextResponse } from 'next/server';
import {
  handleStripeWebhook,
  verifyWebhookSignature,
} from '@/lib/billing/stripe';

/**
 * POST /api/billing/webhook
 * Stripe webhook endpoint
 * 
 * Set in Stripe dashboard:
 * https://your-domain.com/api/billing/webhook
 * 
 * Events to listen for:
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 * - customer.subscription.deleted
 * - customer.subscription.updated
 */
export async function POST(request: NextRequest) {
  try {
    // Get webhook secret
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[WEBHOOK] STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    // Get signature from headers
    const signature = request.headers.get('stripe-signature');

    // Get raw body for signature verification
    const body = await request.text();

    // Verify signature
    const isValid = verifyWebhookSignature(body, signature || undefined, secret);
    if (!isValid) {
      console.error('[WEBHOOK] Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse event
    let event;
    try {
      event = JSON.parse(body);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    // Handle event
    await handleStripeWebhook(event);

    return NextResponse.json(
      { received: true, eventId: event.id },
      { status: 200 }
    );
  } catch (error) {
    console.error('[WEBHOOK] Error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/billing/webhook
 * Test endpoint to verify webhook is configured
 */
export async function GET() {
  const configured = !!process.env.STRIPE_WEBHOOK_SECRET;

  return NextResponse.json({
    webhook: 'stripe-configured',
    configured,
    message: configured
      ? 'Stripe webhook is configured and ready'
      : 'STRIPE_WEBHOOK_SECRET not set - webhooks disabled',
  });
}
