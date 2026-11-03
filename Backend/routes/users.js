const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/authMiddleware');

// Cookie options — shared across login/logout
const COOKIE_OPTIONS = {
  httpOnly: true,          // JS cannot access this cookie (XSS protection)
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: process.env.COOKIE_SAMESITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax'), // 'none' required for cross-domain (Vercel <-> Render)
  maxAge: 3 * 60 * 60 * 1000, // 3 hours in milliseconds
  path: '/',
};

// === SIGN UP ROUTE ===
router.post('/signup', async (req, res) => {
  const { fullName, email, phone, password } = req.body;

  try {
    const userExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userExists.rows.length > 0) {
      return res.status(409).json({ message: "User with this email already exists." });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      "INSERT INTO users (full_name, email, phone_number, password_hash, role) VALUES ($1, $2, $3, $4, 'user') RETURNING id, full_name, email, role",
      [fullName, email, phone, passwordHash]
    );

    res.status(201).json({ message: "User created successfully!", user: newUser.rows[0] });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// === LOGIN ROUTE ===
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (user.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (user.rows[0].is_blocked) {
      return res.status(403).json({ message: "This account has been suspended." });
    }

    if (user.rows[0].role === 'delivery') {
      return res.status(403).json({ 
        message: "This account is registered as a delivery partner. Please sign in via the Delivery Partner portal." 
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const payload = {
      user: {
        id: user.rows[0].id,
        name: user.rows[0].full_name,
        email: user.rows[0].email,
        phone: user.rows[0].phone_number,
        role: user.rows[0].role || 'user'
      }
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '3h' });

    // Set token in HTTP-only cookie — browser will automatically delete it after 3h
    res.cookie('auth_token', token, COOKIE_OPTIONS);

    // Return user info (no token in JSON body — it's in the cookie)
    res.json({ user: payload.user });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// === LOGOUT ROUTE ===
router.post('/logout', (req, res) => {
  // Clear the cookie by setting maxAge to 0
  res.clearCookie('auth_token', { path: '/' });
  res.json({ message: 'Logged out successfully' });
});

// === ME ROUTE — verify current session ===
// Frontend calls this on page load to check if the cookie session is still valid
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;