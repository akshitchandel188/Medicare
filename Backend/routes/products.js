const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET all active products (for users)
router.get('/', async (req, res) => {
    try {
        const { category, subcategory } = req.query;

        let query = 'SELECT * FROM products WHERE is_active = TRUE';
        const params = [];

        if (category) {
            params.push(category);
            query += ` AND category = $${params.length}`;
        }

        if (subcategory) {
            params.push(subcategory);
            query += ` AND subcategory = $${params.length}`;
        }

        query += ' ORDER BY name ASC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// GET single product by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM products WHERE id = $1 AND is_active = TRUE',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
