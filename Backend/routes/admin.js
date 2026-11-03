const express = require('express');
const router = express.Router();
const pool = require('../db');

// ==========================================
// COMPREHENSIVE ANALYTICS ENDPOINT
// ==========================================
router.get('/analytics', async (req, res) => {
    try {
        // 1. Revenue, total orders, and average order value
        const revQuery = `
            SELECT 
                COALESCE(SUM(total_amount), 0) AS total_revenue,
                COUNT(*) AS total_orders,
                COALESCE(AVG(total_amount), 0) AS average_order_value,
                COALESCE(SUM(CASE WHEN DATE(order_date) = CURRENT_DATE THEN total_amount ELSE 0 END), 0) AS revenue_today,
                COUNT(CASE WHEN DATE(order_date) = CURRENT_DATE THEN 1 END) AS orders_today
            FROM orders
        `;
        const revRes = await pool.query(revQuery);

        // 2. Orders grouped by status
        const statusRes = await pool.query(`
            SELECT status, COUNT(*) AS count
            FROM orders 
            GROUP BY status
            ORDER BY count DESC
        `);

        // 3. Daily trend (latest dates)
        const trendRes = await pool.query(`
            SELECT 
                TO_CHAR(order_date, 'YYYY-MM-DD') AS date_str,
                COUNT(*) AS orders_count,
                COALESCE(SUM(total_amount), 0) AS daily_revenue
            FROM orders
            GROUP BY TO_CHAR(order_date, 'YYYY-MM-DD')
            ORDER BY date_str DESC
            LIMIT 7
        `);

        // 4. Products and inventory health
        const invRes = await pool.query(`
            SELECT 
                COUNT(*) AS total_products,
                COUNT(CASE WHEN units_available = 0 THEN 1 END) AS out_of_stock,
                COUNT(CASE WHEN units_available > 0 AND units_available < 15 THEN 1 END) AS low_stock,
                COUNT(CASE WHEN units_available >= 15 THEN 1 END) AS in_stock,
                COUNT(CASE WHEN rx_required = TRUE THEN 1 END) AS rx_count
            FROM products 
            WHERE is_active = TRUE
        `);

        // 5. Product categories distribution
        const catRes = await pool.query(`
            SELECT category, COUNT(*) AS count
            FROM products 
            WHERE is_active = TRUE
            GROUP BY category
            ORDER BY count DESC
            LIMIT 8
        `);

        // 6. Customers analytics
        const custRes = await pool.query(`
            SELECT 
                COUNT(*) AS total_customers,
                COUNT(CASE WHEN is_blocked = FALSE THEN 1 END) AS active_customers,
                COUNT(CASE WHEN is_blocked = TRUE THEN 1 END) AS blocked_customers
            FROM users 
            WHERE role = 'user' OR role IS NULL
        `);

        // 7. Delivery fleet analytics
        const fleetRes = await pool.query(`
            SELECT 
                COUNT(DISTINCT u.id) AS total_riders,
                COUNT(DISTINCT CASE WHEN dp.is_online = TRUE THEN u.id END) AS online_riders,
                COUNT(DISTINCT CASE WHEN dp.is_approved = TRUE THEN u.id END) AS approved_riders,
                COUNT(CASE WHEN o.status = 'Out for Delivery' THEN 1 END) AS active_deliveries_count,
                COUNT(CASE WHEN o.status = 'Delivered' THEN 1 END) AS completed_deliveries_count,
                COUNT(CASE WHEN o.delivery_partner_id IS NULL AND o.status IN ('Order Placed', 'Processing') THEN 1 END) AS unassigned_orders_count
            FROM users u
            LEFT JOIN delivery_profiles dp ON u.id = dp.user_id
            LEFT JOIN orders o ON u.id = o.delivery_partner_id
            WHERE u.role = 'delivery'
        `);

        res.json({
            financials: {
                totalRevenue: parseFloat(revRes.rows[0].total_revenue),
                totalOrders: parseInt(revRes.rows[0].total_orders, 10),
                averageOrderValue: parseFloat(revRes.rows[0].average_order_value),
                revenueToday: parseFloat(revRes.rows[0].revenue_today),
                ordersToday: parseInt(revRes.rows[0].orders_today, 10)
            },
            orderStatuses: statusRes.rows.map(r => ({
                status: r.status,
                count: parseInt(r.count, 10)
            })),
            salesTrend: trendRes.rows.reverse().map(r => ({
                date: r.date_str,
                orders: parseInt(r.orders_count, 10),
                revenue: parseFloat(r.daily_revenue)
            })),
            inventory: {
                totalProducts: parseInt(invRes.rows[0].total_products, 10),
                outOfStock: parseInt(invRes.rows[0].out_of_stock, 10),
                lowStock: parseInt(invRes.rows[0].low_stock, 10),
                inStock: parseInt(invRes.rows[0].in_stock, 10),
                rxRequired: parseInt(invRes.rows[0].rx_count, 10)
            },
            categories: catRes.rows.map(r => ({
                category: r.category,
                count: parseInt(r.count, 10)
            })),
            customers: {
                total: parseInt(custRes.rows[0].total_customers, 10),
                active: parseInt(custRes.rows[0].active_customers, 10),
                blocked: parseInt(custRes.rows[0].blocked_customers, 10)
            },
            fleet: {
                totalRiders: parseInt(fleetRes.rows[0].total_riders || 0, 10),
                onlineRiders: parseInt(fleetRes.rows[0].online_riders || 0, 10),
                approvedRiders: parseInt(fleetRes.rows[0].approved_riders || 0, 10),
                activeDeliveries: parseInt(fleetRes.rows[0].active_deliveries_count || 0, 10),
                completedDeliveries: parseInt(fleetRes.rows[0].completed_deliveries_count || 0, 10),
                unassignedOrders: parseInt(fleetRes.rows[0].unassigned_orders_count || 0, 10)
            }
        });
    } catch (err) {
        console.error("Error in /analytics route:", err);
        res.status(500).json({ message: "Server Error" });
    }
});

// USER MANAGEMENT ROUTES

// GET all users (customers only) for the admin panel
router.get('/users', async (req, res) => {
    try {
        const allUsers = await pool.query(
            "SELECT id, full_name, email, is_blocked, created_at, role FROM users WHERE role = 'user' OR role IS NULL ORDER BY created_at DESC"
        );
        res.json(allUsers.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server Error" });
    }
});

// BLOCK a user
router.put('/users/:id/block', async (req, res) => {
    try {
        await pool.query("UPDATE users SET is_blocked = TRUE WHERE id = $1", [req.params.id]);
        res.json({ message: "User blocked successfully." });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server Error" });
    }
});

// UNBLOCK a user
router.put('/users/:id/unblock', async (req, res) => {
    try {
        await pool.query("UPDATE users SET is_blocked = FALSE WHERE id = $1", [req.params.id]);
        res.json({ message: "User unblocked successfully." });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server Error" });
    }
});



// ORDER MANAGEMENT ROUTES 

// GET all orders (with user email and delivery partner info)
router.get('/orders', async (req, res) => {
    try {
        const allOrders = await pool.query(`
            SELECT 
                o.id, o.total_amount, o.status, o.order_date, 
                o.shipping_name, o.shipping_address, o.shipping_phone,
                u.email,
                o.delivery_partner_id,
                o.delivery_otp,
                dp_user.full_name AS delivery_partner_name,
                dp_user.phone_number AS delivery_partner_phone,
                dp.vehicle_type,
                dp.vehicle_number
            FROM orders o 
            JOIN users u ON o.user_id = u.id 
            LEFT JOIN users dp_user ON o.delivery_partner_id = dp_user.id
            LEFT JOIN delivery_profiles dp ON dp_user.id = dp.user_id
            ORDER BY o.order_date DESC
        `);
        res.json(allOrders.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server Error" });
    }
});

// UPDATE order status
router.put('/orders/:id/status', async (req, res) => {
    const { status } = req.body; // e.g. "Shipped", "Delivered", "Cancelled"
    try {
        await pool.query("UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [status, req.params.id]);
        res.json({ message: "Order status updated." });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server Error" });
    }
});

// ASSIGN / DISPATCH ORDER TO RIDER
router.put('/orders/:id/assign-rider', async (req, res) => {
    const { deliveryPartnerId } = req.body;
    const orderId = req.params.id;

    try {
        // Generate 4-digit numeric verification OTP if not set
        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        const updateResult = await pool.query(
            `UPDATE orders 
             SET delivery_partner_id = $1,
                 status = 'Out for Delivery',
                 picked_up_at = CURRENT_TIMESTAMP,
                 delivery_otp = COALESCE(delivery_otp, $2),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING id, status, delivery_partner_id, delivery_otp`,
            [deliveryPartnerId, otp, orderId]
        );

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ message: "Order not found." });
        }

        res.json({ 
            message: "Rider successfully assigned to order!", 
            order: updateResult.rows[0] 
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server Error" });
    }
});

// ==========================================
// RIDER FLEET MANAGEMENT ROUTES
// ==========================================

// GET all delivery partners
router.get('/riders', async (req, res) => {
    try {
        const ridersQuery = `
            SELECT 
                u.id, u.full_name, u.email, u.phone_number, u.is_blocked, u.created_at,
                dp.id AS profile_id, dp.vehicle_type, dp.vehicle_number, dp.driving_license,
                dp.city, dp.is_approved, dp.is_online, dp.total_deliveries,
                COUNT(CASE WHEN o.status = 'Out for Delivery' THEN 1 END) AS active_orders_count
            FROM users u
            LEFT JOIN delivery_profiles dp ON u.id = dp.user_id
            LEFT JOIN orders o ON u.id = o.delivery_partner_id
            WHERE u.role = 'delivery'
            GROUP BY u.id, dp.id
            ORDER BY u.created_at DESC
        `;
        const result = await pool.query(ridersQuery);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching riders for admin:", err);
        res.status(500).json({ message: "Server Error" });
    }
});

// TOGGLE RIDER APPROVAL STATUS
router.put('/riders/:id/toggle-approval', async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE delivery_profiles 
             SET is_approved = NOT is_approved, updated_at = CURRENT_TIMESTAMP 
             WHERE user_id = $1 
             RETURNING is_approved`,
            [req.params.id]
        );
        res.json({ message: "Rider approval status updated.", is_approved: result.rows[0]?.is_approved });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server Error" });
    }
});

// TOGGLE RIDER ACCOUNT BLOCK
router.put('/riders/:id/toggle-block', async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE users 
             SET is_blocked = NOT is_blocked, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1 AND role = 'delivery'
             RETURNING is_blocked`,
            [req.params.id]
        );
        res.json({ message: "Rider status updated.", is_blocked: result.rows[0]?.is_blocked });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server Error" });
    }
});

// PRODUCT MANAGEMENT ROUTES

// GET all products (for admin)
router.get('/products', async (req, res) => {
    try {
        const allProducts = await pool.query("SELECT * FROM products ORDER BY created_at DESC");
        res.json(allProducts.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server Error" });
    }
});

// ADD a new product
router.post('/products', async (req, res) => {
    try {
        const {
            name, category, subcategory, price, originalPrice, discount,
            description, image, manufacturer, unitsAvailable, rxRequired,
            dosage, sideEffects, precautions, status
        } = req.body;

        const newProduct = await pool.query(
            `INSERT INTO products (
                name, category, subcategory, price, original_price, discount,
                description, image, manufacturer, units_available, rx_required,
                dosage, side_effects, precautions, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *`,
            [name, category, subcategory, price, originalPrice, discount,
                description, image, manufacturer, unitsAvailable, rxRequired,
                dosage, sideEffects, precautions, status]
        );

        res.json(newProduct.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server Error" });
    }
});

// UPDATE a product
router.put('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, category, subcategory, price, originalPrice, discount,
            description, image, manufacturer, unitsAvailable, rxRequired,
            dosage, sideEffects, precautions, status
        } = req.body;

        const updatedProduct = await pool.query(
            `UPDATE products SET
                name = $1, category = $2, subcategory = $3, price = $4,
                original_price = $5, discount = $6, description = $7, image = $8,
                manufacturer = $9, units_available = $10, rx_required = $11,
                dosage = $12, side_effects = $13, precautions = $14, status = $15,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $16
            RETURNING *`,
            [name, category, subcategory, price, originalPrice, discount,
                description, image, manufacturer, unitsAvailable, rxRequired,
                dosage, sideEffects, precautions, status, id]
        );

        if (updatedProduct.rows.length === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.json(updatedProduct.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server Error" });
    }
});

// DELETE a product (soft delete by setting is_active to false)
router.delete('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("UPDATE products SET is_active = FALSE WHERE id = $1", [id]);
        res.json({ message: "Product deleted successfully." });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;