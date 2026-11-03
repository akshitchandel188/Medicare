const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// CORS — allow credentials (cookies) from the frontend
const allowedOrigins = [
  "http://localhost:5173",
  "https://medicine-delivery-website.vercel.app",
  process.env.CLIENT_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.some(o => origin.startsWith(o))) {
      return callback(null, true);
    }
    // Allow any vercel deployment preview if needed
    if (process.env.NODE_ENV === 'production' && origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in deployment with credentials
  },
  credentials: true,
}));

// Parse cookies from every incoming request
app.use(cookieParser());
app.use(express.json());


// --- API Routes ---
// Import all the route files we have created
const userRoutes         = require('./routes/users');
const adminRoutes        = require('./routes/admin');
const orderRoutes        = require('./routes/orders');
const addressRoutes      = require('./routes/addresses');
const productRoutes      = require('./routes/products');
const prescriptionRoutes = require('./routes/prescriptions');
const chatRoutes         = require('./routes/chat'); // RAG-powered chat
const deliveryRoutes     = require('./routes/delivery');

// Tell the server to use these routes
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/products', productRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/chat', chatRoutes); // RAG chat replaces inline handler
app.use('/api/delivery', deliveryRoutes);


// --- Start Server ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});