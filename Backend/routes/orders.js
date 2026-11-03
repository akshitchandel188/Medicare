const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

// === CREATE A NEW ORDER ===
// This is a protected route, so we add the authMiddleware
router.post('/', authMiddleware, async (req, res) => {
  const { userId, cartItems, cartTotal, shippingAddress } = req.body;
  const client = await pool.connect(); // Get a client from the pool for transaction

  try {
    // Start a transaction
    await client.query('BEGIN');

    // 1. Insert into the main 'orders' table
    const orderQuery = `
      INSERT INTO orders (user_id, total_amount, shipping_name, shipping_address, shipping_phone) 
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `;
    // Handle both old and new address field names for backward compatibility
    const shippingName = shippingAddress.full_name || shippingAddress.name;
    const shippingAddr = shippingAddress.address_line || shippingAddress.address;
    const shippingPhone = shippingAddress.phone_number || shippingAddress.phone;

    const orderValues = [userId, cartTotal, shippingName, shippingAddr, shippingPhone];
    const newOrder = await client.query(orderQuery, orderValues);
    const orderId = newOrder.rows[0].id;

    // 2. Insert each cart item into the 'order_items' table with product details
    for (const item of cartItems) {
      const itemQuery = `
        INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase, product_name, product_category)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      const itemValues = [orderId, item.id, item.quantity, item.price, item.name, item.category];
      await client.query(itemQuery, itemValues);
    }

    // If everything is successful, commit the transaction
    await client.query('COMMIT');
    res.status(201).json({ message: 'Order placed successfully!', orderId: orderId });

  } catch (err) {
    // If anything fails, roll back the transaction
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  } finally {
    // Release the client back to the pool
    client.release();
  }
});

// === GET ORDERS FOR A LOGGED-IN USER ===
router.get('/', authMiddleware, async (req, res) => {
  try {
    // req.user.id comes from the authMiddleware
    const userOrders = await pool.query("SELECT * FROM orders WHERE user_id = $1 ORDER BY order_date DESC", [req.user.id]);
    res.json(userOrders.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// === GET SINGLE ORDER DETAILS ===
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user.id;

    // Get order details along with delivery partner info if assigned
    const orderResult = await pool.query(
      `SELECT 
        o.*,
        dp_user.full_name AS delivery_partner_name,
        dp_user.phone_number AS delivery_partner_phone,
        dp.vehicle_type,
        dp.vehicle_number
       FROM orders o
       LEFT JOIN users dp_user ON o.delivery_partner_id = dp_user.id
       LEFT JOIN delivery_profiles dp ON dp_user.id = dp.user_id
       WHERE o.id = $1 AND o.user_id = $2`,
      [orderId, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Get order items
    const itemsResult = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [orderId]
    );

    // Combine order and items
    const orderDetails = {
      ...order,
      items: itemsResult.rows
    };

    res.json(orderDetails);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});


module.exports = router;