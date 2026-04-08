import { Router, Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { pool } from '../config/database';
import { isAuthenticated } from '../middleware/auth';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!
});

// Pricing plans in INR
const PLANS = {
  starter: {
    name: 'Starter',
    price: 0,
    emails: 1000,
    features: ['1,000 emails/month', 'Basic analytics', 'Email support', '1 user']
  },
  professional: {
    name: 'Professional',
    price: 399900, // ₹3,999 in paise
    emails: 50000,
    features: ['50,000 emails/month', 'Advanced analytics', 'Priority support', '5 users', 'Custom templates', 'API access']
  },
  enterprise: {
    name: 'Enterprise',
    price: 1499900, // ₹14,999 in paise
    emails: -1, // Unlimited
    features: ['Unlimited emails', 'Real-time analytics', '24/7 support', 'Unlimited users', 'Custom integrations', 'Dedicated account manager']
  }
};

// Create Razorpay order
router.post('/create-order', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { plan } = req.body;
    const user = req.user as any;

    if (!plan || !PLANS[plan as keyof typeof PLANS]) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    const selectedPlan = PLANS[plan as keyof typeof PLANS];

    if (selectedPlan.price === 0) {
      return res.status(400).json({ error: 'Starter plan is free, no payment required' });
    }

    // Create Razorpay order
    const options = {
      amount: selectedPlan.price, // Amount in paise
      currency: 'INR',
      receipt: `order_${uuidv4()}`,
      notes: {
        userId: user.id,
        plan: plan,
        planName: selectedPlan.name
      }
    };

    const order = await razorpay.orders.create(options);

    // Save order to database
    await pool.query(
      `INSERT INTO payment_orders (id, user_id, plan, amount, currency, status, razorpay_order_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [uuidv4(), user.id, plan, selectedPlan.price, 'INR', 'created', order.id]
    );

    logger.info({ userId: user.id, plan, orderId: order.id }, 'Payment order created');

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to create payment order');
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// Verify payment
router.post('/verify-payment', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const user = req.user as any;

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      logger.warn({ userId: user.id, orderId: razorpay_order_id }, 'Payment signature verification failed');
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    // Get order details from database
    const orderResult = await pool.query(
      'SELECT * FROM payment_orders WHERE razorpay_order_id = $1 AND user_id = $2',
      [razorpay_order_id, user.id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Update order status
    await pool.query(
      `UPDATE payment_orders 
       SET status = 'completed', razorpay_payment_id = $1, updated_at = NOW()
       WHERE razorpay_order_id = $2`,
      [razorpay_payment_id, razorpay_order_id]
    );

    // Create or update subscription
    const subscriptionId = uuidv4();
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

    await pool.query(
      `INSERT INTO subscriptions (id, user_id, plan, status, start_date, end_date, created_at)
       VALUES ($1, $2, $3, 'active', $4, $5, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         plan = EXCLUDED.plan,
         status = 'active',
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date,
         updated_at = NOW()`,
      [subscriptionId, user.id, order.plan, startDate, endDate]
    );

    logger.info({ 
      userId: user.id, 
      plan: order.plan, 
      paymentId: razorpay_payment_id 
    }, 'Payment verified and subscription activated');

    res.json({ 
      success: true, 
      message: 'Payment successful! Your subscription is now active.',
      subscription: {
        plan: order.plan,
        startDate,
        endDate
      }
    });
  } catch (err: any) {
    logger.error({ error: err.message }, 'Payment verification failed');
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// Get current subscription
router.get('/subscription', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;

    const result = await pool.query(
      `SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );

    if (result.rows.length === 0) {
      return res.json({ 
        plan: 'starter',
        status: 'active',
        features: PLANS.starter.features
      });
    }

    const subscription = result.rows[0];
    const planDetails = PLANS[subscription.plan as keyof typeof PLANS];

    res.json({
      ...subscription,
      features: planDetails.features,
      emailLimit: planDetails.emails
    });
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to fetch subscription');
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Get payment history
router.get('/history', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;

    const result = await pool.query(
      `SELECT id, plan, amount, currency, status, razorpay_payment_id, created_at
       FROM payment_orders 
       WHERE user_id = $1 AND status = 'completed'
       ORDER BY created_at DESC 
       LIMIT 50`,
      [user.id]
    );

    res.json(result.rows);
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to fetch payment history');
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

export default router;
