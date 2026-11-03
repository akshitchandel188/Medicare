const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/authMiddleware');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.COOKIE_SAMESITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
  maxAge: 3 * 60 * 60 * 1000,
  path: '/',
};

// Middleware to ensure user is a delivery partner
const deliveryOnly = (req, res, next) => {
  if (req.user && req.user.role === 'delivery') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied: Delivery Partner role required.' });
};

// ==========================================
// 1. DELIVERY PARTNER SIGNUP
// ==========================================
router.post('/signup', async (req, res) => {
  const {
    fullName,
    email,
    phone,
    password,
    vehicleType = 'Motorcycle',
    vehicleNumber = '',
    drivingLicense = '',
    city = 'Delhi NCR'
  } = req.body;

  if (!fullName || !email || !password || !phone) {
    return res.status(400).json({ message: 'Name, email, phone, and password are required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if email already exists
    const userExists = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user with role 'delivery'
    const newUserResult = await client.query(
      `INSERT INTO users (full_name, email, phone_number, password_hash, role)
       VALUES ($1, $2, $3, $4, 'delivery')
       RETURNING id, full_name, email, phone_number, role`,
      [fullName, email, phone, passwordHash]
    );
    const newUser = newUserResult.rows[0];

    // Create delivery_profile
    await client.query(
      `INSERT INTO delivery_profiles (user_id, vehicle_type, vehicle_number, driving_license, city, is_approved, is_online)
       VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)`,
      [newUser.id, vehicleType, vehicleNumber, drivingLicense, city]
    );

    await client.query('COMMIT');

    // Create JWT auth cookie for immediate login
    const payload = {
      user: {
        id: newUser.id,
        name: newUser.full_name,
        email: newUser.email,
        phone: newUser.phone_number,
        role: newUser.role
      }
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '3h' });
    res.cookie('auth_token', token, COOKIE_OPTIONS);

    res.status(201).json({
      message: 'Delivery partner registered successfully!',
      user: payload.user
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in delivery signup:', err);
    res.status(500).json({ message: 'Server error during registration.' });
  } finally {
    client.release();
  }
});

// ==========================================
// 1b. DELIVERY PARTNER LOGIN
// ==========================================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const user = result.rows[0];

    // Ensure this account has delivery partner role
    if (user.role !== 'delivery') {
      return res.status(403).json({
        message: "This account is registered as a customer, not a delivery partner. Please sign in via the customer store."
      });
    }

    if (user.is_blocked) {
      return res.status(403).json({ message: "This delivery account has been suspended. Please contact admin support." });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const payload = {
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        phone: user.phone_number,
        role: user.role
      }
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '3h' });
    res.cookie('auth_token', token, COOKIE_OPTIONS);

    res.json({
      message: "Delivery partner logged in successfully!",
      user: payload.user
    });
  } catch (err) {
    console.error('Error in delivery login:', err);
    res.status(500).json({ message: "Server error during login." });
  }
});

// ==========================================
// 2. GET CURRENT DELIVERY PARTNER PROFILE & STATS
// ==========================================
router.get('/profile', authMiddleware, deliveryOnly, async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id, u.full_name, u.email, u.phone_number, u.role,
        dp.vehicle_type, dp.vehicle_number, dp.city, dp.is_approved, dp.is_online,
        dp.total_deliveries, dp.current_lat, dp.current_lng
      FROM users u
      LEFT JOIN delivery_profiles dp ON u.id = dp.user_id
      WHERE u.id = $1
    `;
    const result = await pool.query(query, [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Profile not found.' });
    }

    // Also get active deliveries count and today's delivered count
    const statsQuery = `
      SELECT 
        COUNT(CASE WHEN status = 'Out for Delivery' AND delivery_partner_id = $1 THEN 1 END) AS active_orders_count,
        COUNT(CASE WHEN status = 'Delivered' AND delivery_partner_id = $1 AND DATE(delivered_at) = CURRENT_DATE THEN 1 END) AS delivered_today_count,
        COUNT(CASE WHEN status = 'Delivered' AND delivery_partner_id = $1 THEN 1 END) AS total_delivered_count
      FROM orders
    `;
    const statsRes = await pool.query(statsQuery, [req.user.id]);

    res.json({
      profile: result.rows[0],
      stats: {
        activeOrders: parseInt(statsRes.rows[0].active_orders_count || 0, 10),
        deliveredToday: parseInt(statsRes.rows[0].delivered_today_count || 0, 10),
        totalDelivered: parseInt(statsRes.rows[0].total_delivered_count || 0, 10),
        estimatedEarningsToday: parseInt(statsRes.rows[0].delivered_today_count || 0, 10) * 50 // ₹50 per delivery base payout
      }
    });
  } catch (err) {
    console.error('Error fetching delivery profile:', err);
    res.status(500).json({ message: 'Server error fetching profile.' });
  }
});

// ==========================================
// 3. TOGGLE ONLINE / DUTY STATUS
// ==========================================
router.put('/duty-status', authMiddleware, deliveryOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE delivery_profiles 
       SET is_online = NOT is_online, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING is_online`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Delivery profile not found.' });
    }

    res.json({
      message: `You are now ${result.rows[0].is_online ? 'Online' : 'Offline'}`,
      isOnline: result.rows[0].is_online
    });
  } catch (err) {
    console.error('Error toggling duty status:', err);
    res.status(500).json({ message: 'Server error toggling duty status.' });
  }
});

// ==========================================
// 4. GET AVAILABLE ORDERS (READY FOR PICKUP)
// ==========================================
router.get('/orders/available', authMiddleware, deliveryOnly, async (req, res) => {
  try {
    const query = `
      SELECT 
        o.id, o.total_amount, o.status, o.order_date,
        o.shipping_name, o.shipping_address, o.shipping_phone,
        COALESCE(json_agg(
          json_build_object(
            'id', oi.id,
            'product_name', oi.product_name,
            'quantity', oi.quantity,
            'price', oi.price_at_purchase
          )
        ) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.delivery_partner_id IS NULL
        AND o.status IN ('Order Placed', 'Processing')
      GROUP BY o.id
      ORDER BY o.order_date DESC
      LIMIT 20
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching available orders:', err);
    res.status(500).json({ message: 'Server error fetching available orders.' });
  }
});

// ==========================================
// 5. GET ACTIVE ORDERS FOR CURRENT RIDER
// ==========================================
router.get('/orders/active', authMiddleware, deliveryOnly, async (req, res) => {
  try {
    const query = `
      SELECT 
        o.id, o.total_amount, o.status, o.order_date, o.picked_up_at,
        o.shipping_name, o.shipping_address, o.shipping_phone,
        o.delivery_otp, o.delivery_notes,
        COALESCE(json_agg(
          json_build_object(
            'id', oi.id,
            'product_name', oi.product_name,
            'quantity', oi.quantity,
            'price', oi.price_at_purchase
          )
        ) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.delivery_partner_id = $1
        AND o.status IN ('Out for Delivery', 'Processing')
      GROUP BY o.id
      ORDER BY o.order_date DESC
    `;
    const result = await pool.query(query, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching active orders:', err);
    res.status(500).json({ message: 'Server error fetching active orders.' });
  }
});

// ==========================================
// 6. GET COMPLETED DELIVERY HISTORY
// ==========================================
router.get('/orders/history', authMiddleware, deliveryOnly, async (req, res) => {
  try {
    const query = `
      SELECT 
        o.id, o.total_amount, o.status, o.order_date, o.delivered_at, o.picked_up_at,
        o.shipping_name, o.shipping_address, o.shipping_phone,
        COALESCE(json_agg(
          json_build_object(
            'product_name', oi.product_name,
            'quantity', oi.quantity
          )
        ) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.delivery_partner_id = $1
        AND o.status = 'Delivered'
      GROUP BY o.id
      ORDER BY o.delivered_at DESC
      LIMIT 50
    `;
    const result = await pool.query(query, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching delivery history:', err);
    res.status(500).json({ message: 'Server error fetching history.' });
  }
});

// ==========================================
// 7. ACCEPT / CLAIM AN ORDER
// ==========================================
router.post('/orders/:id/accept', authMiddleware, deliveryOnly, async (req, res) => {
  const orderId = req.params.id;
  try {
    // Generate 4-digit numeric verification OTP for the customer
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    const updateQuery = `
      UPDATE orders 
      SET 
        delivery_partner_id = $1,
        status = 'Out for Delivery',
        picked_up_at = CURRENT_TIMESTAMP,
        delivery_otp = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND (delivery_partner_id IS NULL OR delivery_partner_id = $1)
      RETURNING id, status, delivery_partner_id, picked_up_at
    `;
    const result = await pool.query(updateQuery, [req.user.id, otp, orderId]);

    if (result.rows.length === 0) {
      return res.status(409).json({ message: 'Order is no longer available or was claimed by another rider.' });
    }

    res.json({
      message: 'Order accepted for delivery! Head to pickup/destination.',
      order: result.rows[0]
    });
  } catch (err) {
    console.error('Error accepting order:', err);
    res.status(500).json({ message: 'Server error accepting order.' });
  }
});

// ==========================================
// 8. VERIFY OTP AND MARK AS DELIVERED
// ==========================================
router.post('/orders/:id/deliver', authMiddleware, deliveryOnly, async (req, res) => {
  const orderId = req.params.id;
  const { otp, notes } = req.body;

  try {
    // Get order OTP
    const orderCheck = await pool.query(
      'SELECT delivery_otp, status FROM orders WHERE id = $1 AND delivery_partner_id = $2',
      [orderId, req.user.id]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found or not assigned to you.' });
    }

    const correctOtp = orderCheck.rows[0].delivery_otp;

    // Validate OTP if set (allow bypass if no OTP was generated or matches)
    if (correctOtp && otp && otp.toString().trim() !== correctOtp.trim()) {
      return res.status(400).json({ message: 'Invalid OTP code. Please ask customer for the correct 4-digit code.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update order to Delivered
      await client.query(
        `UPDATE orders 
         SET status = 'Delivered', 
             delivered_at = CURRENT_TIMESTAMP, 
             delivery_notes = COALESCE($1, delivery_notes),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [notes || 'Delivered safely to patient', orderId]
      );

      // Increment total deliveries for this rider
      await client.query(
        `UPDATE delivery_profiles 
         SET total_deliveries = total_deliveries + 1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [req.user.id]
      );

      await client.query('COMMIT');

      res.json({ message: 'Order successfully marked as Delivered! Great job!' });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Error completing delivery:', err);
    res.status(500).json({ message: 'Server error completing delivery.' });
  }
});

module.exports = router;
