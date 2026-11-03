# 🏥 HealthMeds — Full-Stack Medicine Delivery & Healthcare Platform

A production-grade, full-stack online pharmacy and medicine delivery platform built with **React 19**, **Node.js**, **Express**, and **PostgreSQL with pgvector**. Features an AI-powered Medical Chatbot (RAG), a dedicated **Delivery Fleet Rider Portal**, real-time order tracking, prescription management, and an Admin control center.

---

## 🌟 Key Features

### 🛒 1. Customer E-Commerce Experience
* **Medicine Catalog & Filtering:** Browse routine and prescription medications with dosage, manufacturer details, and side-effect precautions.
* **Instant Search & Autocomplete:** Real-time search suggestions with category tags and price previews.
* **Cart & Multi-Step Checkout:** Smooth checkout flow with saved address selection, phone confirmation, and delivery preferences.
* **Live Order Tracking:** Step-by-step order timeline (`Order Placed` ➔ `Processing` ➔ `Out for Delivery` ➔ `Delivered`) with interactive tracking map simulation.
* **Delivery Security PIN (OTP):** Dynamic 4-digit PIN generated upon dispatch to ensure medicines are only handed over to verified patients.

### 🤖 2. AI Medical Assistant (RAG Chatbot)
* **Retrieval-Augmented Generation (RAG):** Powered by Groq AI (`openai/gpt-oss-120b` / `qwen/qwen3.8-27b`) and PostgreSQL knowledge retrieval.
* **Semantic Knowledge Retrieval:** Cosine similarity search across chunked medicine monographs, dosage guidelines, precautions, and wellness blogs.
* **Live Inventory Integration:** Real-time price and stock lookup directly from the database during conversational queries.
* **Safe Medical Disclaimers:** Automatic verification badges and emergency consult reminders.

### 🛵 3. Delivery Fleet & Rider Dashboard (`/delivery/dashboard`)
* **Dedicated Rider Portal:** Mobile-first portal with separate rider registration (`/delivery/signup`) and authentication (`/delivery/login`).
* **Duty Status Switch:** Live toggle between 🟢 **Online • Ready** and ⚪ **Offline**.
* **Pickup Pool:** Available orders waiting for dispatch with destination preview and trip payout indicators (`+₹50/delivery`).
* **One-Tap Navigation & Contact:** One-click **🗺️ Open GPS Navigation** (turn-by-turn route via Google Maps) and direct **📞 Call Customer** links.
* **Secure Handover Verification:** Built-in modal requiring the customer's 4-digit PIN before marking an order as `Delivered`.
* **Driver Performance & Earnings:** Live tracking of today's payout, completed trips, and lifetime deliveries.

### 📋 4. Prescription Upload
* Secure drag-and-drop prescription document uploader supporting images and PDFs.
* Dedicated backend storage with MIME-type validation.

### 🛡️ 5. Admin Management Portal (`/admin`)
* **Inventory Control:** Add, edit, price, and monitor stock availability for medications.
* **Order Processing:** Oversee customer orders and advance shipping statuses.
* **User Management:** Monitor registered accounts with account suspension and reactivation controls.

---

## 📁 Repository Structure

```
Medicine-Delivery-App/
├── Backend/
│   ├── middleware/
│   │   └── authMiddleware.js            # Cookie-based JWT verification
│   ├── migrations/
│   │   ├── 001_create_users_table.sql
│   │   ├── 002_create_products_table.sql
│   │   ├── 003_create_orders_tables.sql
│   │   ├── 004_create_addresses_table.sql
│   │   ├── 005_create_prescriptions_table.sql
│   │   ├── 006_add_pgvector_knowledge.sql
│   │   └── 007_create_delivery_tables.sql
│   ├── rag/
│   │   ├── ingest.js                    # Chunks data & generates embeddings
│   │   ├── productSearch.js             # Live database stock/price lookup
│   │   └── retriever.js                 # pgvector cosine similarity search
│   ├── routes/
│   │   ├── addresses.js                 # Saved addresses
│   │   ├── admin.js                     # Admin panel APIs
│   │   ├── chat.js                      # RAG medical chatbot endpoint
│   │   ├── delivery.js                  # Rider fleet & delivery dashboard APIs
│   │   ├── orders.js                    # Order placement & customer tracking
│   │   ├── prescriptions.js             # Prescription uploads
│   │   ├── products.js                  # Product catalog
│   │   └── users.js                     # Authentication (login, signup, session)
│   ├── db.js                            # PostgreSQL pool connection
│   ├── migrate.js                       # Migration runner
│   ├── server.js                        # Express server entry point
│   └── package.json
│
├── Frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AdminPage/               # Admin dashboard & controls
│   │   │   ├── Chatbot/                 # AI Assistant floating interface
│   │   │   ├── Footer/                  # Site footer with fleet links
│   │   │   ├── Header/                  # Navbar & category navigation
│   │   │   ├── Layout/                  # Standard application layout
│   │   │   └── OrderTrackingMap/        # Visual delivery map simulator
│   │   ├── context/
│   │   │   └── AuthContext.jsx          # Session state & role-based routing
│   │   ├── pages/
│   │   │   ├── AllProductsPage.jsx      # Medication catalog & search
│   │   │   ├── CartPage.jsx             # Shopping cart
│   │   │   ├── CheckoutPage.jsx         # Address & checkout
│   │   │   ├── DeliveryDashboardPage.jsx# 🛵 Rider operations dashboard
│   │   │   ├── DeliveryLoginPage.jsx    # Rider login portal
│   │   │   ├── DeliverySignUpPage.jsx   # Rider fleet onboarding
│   │   │   ├── HomePage.jsx             # Landing page
│   │   │   ├── OrderDetailPage.jsx      # Customer tracking & security PIN
│   │   │   ├── ProductDetailPage.jsx    # Product specifications
│   │   │   └── ProfilePage.jsx          # User profile & order history
│   │   ├── App.jsx                      # Route definitions & guards
│   │   └── main.jsx
│   ├── vite.config.js
│   └── package.json
│
└── README.md
```

---

## 🛠️ Tech Stack

* **Frontend:** React 19, Vite, React Router 7, React Icons, Vanilla CSS (Design Tokens & Glassmorphism).
* **Backend:** Node.js, Express, `pg` (PostgreSQL client), `jsonwebtoken`, `bcryptjs`, `cookie-parser`, `multer`.
* **AI & Search:** Groq API (`groq-sdk`), PostgreSQL knowledge base & `pgvector`.
* **Database:** PostgreSQL 15+ / 16+.

---

## ⚙️ Environment Variables Setup

### Backend (`Backend/.env`)
Create a `.env` file in the `Backend/` directory:
```env
PORT=3001
JWT_SECRET=your_super_secret_jwt_key

# PostgreSQL Connection
DB_USER=postgres
DB_HOST=localhost
DB_DATABASE=medicine_delivery
DB_PASSWORD=your_postgres_password
DB_PORT=5432

# Groq AI (for RAG Chatbot)
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b
```

### Frontend (`Frontend/.env`)
Create a `.env` file in the `Frontend/` directory:
```env
VITE_API_URL=http://localhost:3001
```

---

## 🚀 Getting Started

### 1. Database Setup & Migrations
Ensure PostgreSQL is running and you have created your database:
```sql
CREATE DATABASE medicine_delivery;
```
Run all automated migrations (from `001` through `007`):
```bash
cd Backend
npm install
npm run migrate
```

### 2. (Optional) Ingest Medical Knowledge for AI Chatbot
To populate the vector knowledge base with medicine monographs and blog articles:
```bash
cd Backend
npm run ingest:rag
```

### 3. Start the Backend Server
```bash
cd Backend
npm start
# Server runs on http://localhost:3001
```

### 4. Start the Frontend Development Server
```bash
cd Frontend
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

---

## 🛵 Delivery Fleet Testing Quick-Start

1. **Rider Registration:** Visit `http://localhost:5173/delivery/signup` to register a delivery partner account.
2. **Accept Deliveries:** In the Rider Dashboard, toggle status to **Online • Ready**, switch to the **Pickup Pool** tab, and click **"Accept & Start Delivery"**.
3. **Customer Handover:** Open the customer order tracking page (`/orders/:id`) to find the **4-digit Security PIN**.
4. **Complete Trip:** Back in the Rider Dashboard, click **"Verify OTP & Deliver"**, enter the PIN, and confirm handover.

---

## 📄 License
This project is licensed under the MIT License.
