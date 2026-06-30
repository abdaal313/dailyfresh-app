
# DairyFresh - Cold-Pressed Juice Delivery Platform

Production-ready backend and frontend for juice delivery service.

## 📋 Prerequisites

- Node.js 14+ 
- MySQL 5.7+
- Gmail account with App Password enabled
- npm or yarn

## 🚀 Setup Instructions

### 1. Clone Repository
```bash
git clone <repository-url>
cd dairyfresh
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
```bash
# Copy example file
cp .env.example .env

# Edit with your values
nano .env
```

Required variables:
- `DB_HOST` - MySQL host (usually localhost)
- `DB_USER` - MySQL user (usually root)
- `DB_PASSWORD` - MySQL password
- `DB_NAME` - Database name (barista_db)
- `EMAIL_USER` - Gmail address
- `EMAIL_PASSWORD` - Gmail App Password
- `ADMIN_PASSWORD` - Your admin panel password
- `PORT` - Server port (default: 3000)

### 4. Setup Database

Create database and tables:
```sql
CREATE DATABASE IF NOT EXISTS barista_db;

USE barista_db;

-- Orders Table
CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  email VARCHAR(255),
  items_json LONGTEXT,
  total DECIMAL(10, 2),
  payment_method VARCHAR(50),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  status VARCHAR(50) DEFAULT 'Pending',
  rating INT,
  feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Menu Items Table
CREATE TABLE menu_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  price DECIMAL(10, 2),
  image VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscribers Table
CREATE TABLE subscribers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  subscribed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employees Table
CREATE TABLE employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  role VARCHAR(255),
  email VARCHAR(255),
  salary DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Businesses Table
CREATE TABLE businesses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop_name VARCHAR(255),
  owner_name VARCHAR(255),
  unique_id VARCHAR(255),
  address TEXT,
  product_type VARCHAR(255),
  image VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5. Run Development Server
```bash
npm run dev
```

Server runs on `http://localhost:3000`

## 📦 Production Deployment

### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start server-production.js --name "dairyfresh"

# Save configuration
pm2 save

# Enable auto-start on reboot
pm2 startup
```

### Using Docker

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t dairyfresh .
docker run -p 3000:3000 --env-file .env dairyfresh
```

### Environment Variables Checklist

Before deployment:

```bash
# Database
DB_HOST=your_db_host
DB_USER=your_db_user
DB_PASSWORD=your_secure_password
DB_NAME=barista_db

# Email (Gmail with App Password)
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Server
PORT=3000
NODE_ENV=production
ADMIN_PASSWORD=your_secure_admin_password

# Security
ALLOWED_ORIGINS=https://yourdomain.com
```

## 📡 API Endpoints

### Public Endpoints
- `GET /api/menu` - Get menu items
- `POST /api/subscribe` - Subscribe to newsletter
- `POST /api/checkout` - Place order
- `GET /api/order/:orderId` - Get order status
- `GET /api/health` - Health check

### Admin Endpoints
- `POST /api/admin/login` - Admin login
- `GET /api/admin/data` - Get all admin data
- `POST /api/admin/add-product` - Add menu item
- `DELETE /api/admin/delete-product/:id` - Delete menu item
- `POST /api/admin/add-employee` - Add employee
- `DELETE /api/admin/delete-employee/:id` - Delete employee
- `POST /api/admin/add-business` - Add business
- `DELETE /api/admin/delete-business/:id` - Delete business
- `POST /api/confirm-order` - Confirm order

### Delivery Endpoints
- `GET /api/delivery/orders` - Get confirmed orders
- `POST /api/orders/:orderId/status` - Update order status
- `POST /api/order/rate` - Rate order

## 🔐 Security Features

✅ Removed all debug logs
✅ Environment variables for secrets
✅ Input validation
✅ SQL injection prevention (parameterized queries)
✅ File upload validation
✅ CORS configuration
✅ Error handling without sensitive info
✅ No hardcoded credentials

See [SECURITY.md](./SECURITY.md) for detailed security guidelines.

## 📁 Project Structure

```
dairyfresh/
├── server-production.js      # Production server (no debug logs)
├── server.js                 # Development server
├── .env.example              # Environment template
├── .gitignore               # Git ignore rules
├── package.json             # Dependencies
├── SECURITY.md              # Security guidelines
├── README.md                # This file
├── admin.html               # Admin dashboard
├── login.html               # Admin login
├── shop.html                # Shop page
├── index.html               # Home page
├── shop.js                  # Shopping cart logic
├── admin.js                 # Admin panel logic
└── uploads/                 # Product images (auto-created)
```

## 🛠️ Troubleshooting

### Database Connection Failed
```bash
# Check MySQL is running
mysql -u root -p

# Verify credentials in .env
# Make sure database exists
```

### Email Not Sending
```bash
# Enable Gmail App Password
# 1. Go to myaccount.google.com
# 2. Security → App Passwords
# 3. Select Mail and Windows Device
# 4. Copy password to .env
```

### Port Already in Use
```bash
# Use different port in .env
PORT=3001
```

## 📚 Technologies Used

- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Email**: Nodemailer (Gmail SMTP)
- **File Upload**: Multer
- **Frontend**: HTML, CSS, JavaScript
- **Maps**: Google Maps API (for delivery tracking)

## 📞 Support

For issues or questions:
1. Check SECURITY.md for security concerns
2. Review error logs
3. Check database connection
4. Ensure .env file is configured

## 📄 License

ISC License

## ⚠️ Important Notes

- **DO NOT** commit `.env` file to git
- **DO NOT** log sensitive information
- **DO** change default admin password immediately
- **DO** use HTTPS in production
- **DO** keep dependencies updated

## Version History

- **1.0.0** - Production ready release
  - All debug logs removed
  - Environment variables configured
  - Security hardened
  - Production-ready server

---

Last Updated: 2026-06-27
Status: ✅ Production Ready