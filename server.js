const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

require('dotenv').config();

const app = express();

// ========== SECURITY & CORS ==========
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://unpkg.com"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
               connectSrc: [
    "'self'",
    "https://https://dailyfresh-app.onrender.com",   // <-- your actual Render URL
    "https://nominatim.openstreetmap.org",  // if you're using OSM search/geocoding
    "https://unpkg.com"
],
                
                // FIXED: Added unpkg.com (for the marker pin) and base openstreetmap
                imgSrc: ["'self'", "data:", "blob:", "https://*.tile.openstreetmap.org", "https://tile.openstreetmap.org", "https://unpkg.com"],
                
                scriptSrcAttr: ["'unsafe-inline'", "'unsafe-hashes'"],
            },
        },
    })
);

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-portal-password'],
    credentials: true
}));

app.set('trust proxy', 1);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========== STATIC FILES ==========
// Serve uploads first, then the rest of the site (html/css/js) from this folder.
// Using __dirname makes this work no matter which directory you run "node server.js" from.
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));
app.use(express.static(__dirname));

// ========== RATE LIMITING ==========

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts, please try again later',
    skipSuccessfulRequests: true,
});

const checkoutLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: 'Too many checkout attempts',
});

app.use('/api', globalLimiter);

// ========== DATABASE CONNECTION ======= // Or 'mysql'

// Use a POOL instead of a single connection
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: { rejectUnauthorized: false }
});

// Export the pool so you can use it throughout your app
module.exports = pool;

// ========== FILE UPLOAD SETUP ==========

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedExts.includes(ext)) {
        return cb(new Error('Invalid file type. Only JPG, PNG, GIF, WebP allowed'));
    }
    cb(null, true);
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: fileFilter
});

// ========== EMAIL SERVICE ==========

let transporter = null;
if (process.env.BREVO_API_KEY) {
    const Sib = require('nodemailer-brevo-transport');
    transporter = nodemailer.createTransport(new Sib({
        apiKey: process.env.BREVO_API_KEY
    }));

    transporter.verify((error) => {
        if (error) {
            console.error('Email service error:', error.message);
        } else {
            console.log('✅ Email service ready');
        }
    });
} else {
    console.warn('⚠️ BREVO_API_KEY not set — emails will be skipped (orders/subscriptions still work).');
}

const sendEmail = (to, subject, html) => {
    return new Promise((resolve, reject) => {
        if (!transporter) {
            console.warn(`(Email skipped — no transporter configured) Would have sent "${subject}" to ${to}`);
            return resolve(false);
        }
        transporter.sendMail({
            from: process.env.EMAIL_USER,
            to,
            subject,
            html
        }, (err) => {
            if (err) reject(err);
            else resolve(true);
        });
    });
};

// ========== AUTHENTICATION MIDDLEWARE ==========

const authMiddleware = (req, res, next) => {
    // 1. Extract credentials from headers
    const authHeader = req.headers.authorization;
    const portalPassword = req.headers['x-portal-password'];
    console.log("Auth Header:", authHeader);
    console.log("Password Header:", portalPassword);

    // 2. CHECK OPTION A: Admin JWT Token
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.admin = decoded; // Attach user info to request
            return next();
        } catch (error) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
    }

    // 3. CHECK OPTION B: Delivery Portal Password
    // Check if the provided password matches your hardcoded value
   // Check for Delivery Portal Password securely
    if (portalPassword && portalPassword === process.env.DELIVERY_PASSWORD) {
        req.isDeliveryPartner = true; // Mark request as coming from partner
        return next();
    }

    // 4. Deny if neither matches
    return res.status(401).json({ error: 'Unauthorized: No valid credentials' });
};

// ========== VALIDATION FUNCTIONS ==========

const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validatePhone = (phone) => {
    const phoneDigits = phone.replace(/\D/g, '');
    return phoneDigits.length === 10;
};

const validatePrice = (price) => {
    const p = parseFloat(price);
    return !isNaN(p) && p > 0 && p <= 100000;
};

const validateString = (str, minLen = 2, maxLen = 255) => {
    return typeof str === 'string' && str.trim().length >= minLen && str.trim().length <= maxLen;
};

const validateCoordinates = (lat, lng) => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    return !isNaN(latitude) && !isNaN(longitude) &&
        latitude >= -90 && latitude <= 90 &&
        longitude >= -180 && longitude <= 180;
};

// ========== API ROUTES ==========

app.post('/api/admin/login', authLimiter, (req, res) => {
    try {
        const { password } = req.body;

        if (!process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) {
            console.error("CRITICAL: JWT_SECRET or ADMIN_PASSWORD missing in .env");
            return res.status(500).json({ error: 'Server configuration error' });
        }

        if (!password) {
            return res.status(400).json({ message: 'Password required' });
        }

        if (password === process.env.ADMIN_PASSWORD) {
            const token = jwt.sign(
                { admin: true, loginTime: new Date() },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            return res.status(200).json({
                message: 'Login successful',
                success: true,
                token
            });
        } else {
            return res.status(401).json({
                message: 'Incorrect password',
                success: false
            });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// GET MENU
app.get('/api/menu', (req, res) => {
    pool.query('SELECT id, name, price, image FROM menu_items ORDER BY id DESC', (err, results) => {
        if (err) {
            console.error('Menu fetch error:', err.message);
            return res.status(500).json({ error: 'Failed to fetch menu. Is MySQL running and the menu_items table created?' });
        }
        res.json(results || []);
    });
});

// SUBSCRIBE TO NEWSLETTER
app.post('/api/subscribe', (req, res) => {
    const { email } = req.body;

    if (!email || !validateEmail(email)) {
        return res.status(400).json({ message: 'Invalid email address' });
    }

    pool.query('SELECT id FROM subscribers WHERE email = ?', [email.toLowerCase()], (err, results) => {
        if (err) {
            console.error('Subscribe check error:', err.message);
            return res.status(500).json({ message: 'Database error' });
        }

        if (results && results.length > 0) {
            return res.status(400).json({ message: 'Already subscribed!' });
        }

        pool.query(
            'INSERT INTO subscribers (email, subscribed_date) VALUES (?, NOW())',
            [email.toLowerCase()],
            (err) => {
                if (err) {
                    console.error('Subscribe insert error:', err.message);
                    return res.status(500).json({ message: 'Failed to subscribe' });
                }

                const mailOptions = {
                    subject: 'Welcome to DairyFresh! Here\'s Your 30% Off Code',
                    html: `<div style="font-family: Arial, sans-serif; background: #f0f4f8; padding: 20px;">
                        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 15px; padding: 30px;">
                            <h2 style="color: #2d3748; text-align: center;">Welcome to DairyFresh! 🥤</h2>
                            <p style="color: #718096; font-size: 16px;">Thank you for subscribing!</p>
                            <div style="background: #f6ad55; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
                                <h3 style="color: #fff; font-size: 28px; margin: 10px 0;">FRESH30</h3>
                                <p style="color: #fff; font-size: 14px;">Save 30% on your first order!</p>
                            </div>
                        </div></div>`
                };

                sendEmail(email, mailOptions.subject, mailOptions.html)
                    .catch(() => console.error('Email send failed'));

                res.status(200).json({ message: 'Subscribed successfully! Check your email.' });
            }
        );
    });
});

// CHECKOUT
app.post('/api/checkout', checkoutLimiter, (req, res) => {
    const { customer, items, total, paymentMethod, lat, lng } = req.body;

    if (!customer || !customer.name || !customer.email || !customer.phone || !customer.address) {
        return res.status(400).json({ message: 'Complete customer information required' });
    }

    if (!validateString(customer.name, 2, 100)) {
        return res.status(400).json({ message: 'Invalid customer name' });
    }

    if (!validateEmail(customer.email)) {
        return res.status(400).json({ message: 'Invalid email address' });
    }

    if (!validatePhone(customer.phone)) {
        return res.status(400).json({ message: 'Invalid phone number (10 digits required)' });
    }

    if (!validateString(customer.address, 5, 500)) {
        return res.status(400).json({ message: 'Invalid address' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Order must contain at least one item' });
    }

    const totalAmount = parseFloat(total);
    if (!totalAmount || totalAmount <= 0 || totalAmount > 1000000) {
        return res.status(400).json({ message: 'Invalid order total' });
    }

    if (!validateCoordinates(lat, lng)) {
        return res.status(400).json({ message: 'Please set delivery location on map' });
    }

    if (!paymentMethod || (paymentMethod !== 'UPI' && paymentMethod !== 'STRIPE')) {
        return res.status(400).json({ message: 'Invalid payment method' });
    }

    const query = `INSERT INTO orders 
        (customer_name, phone, address, email, items_json, total, payment_method, latitude, longitude, status, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())`;

    const queryValues = [
        customer.name.trim(),
        customer.phone.trim(),
        customer.address.trim(),
        customer.email.toLowerCase().trim(),
        JSON.stringify(items),
        totalAmount,
        paymentMethod,
        parseFloat(lat),
        parseFloat(lng)
    ];

    pool.query(query, queryValues, (err, result) => {
        if (err) {
            console.error('Order creation error:', err.message);
            return res.status(500).json({ message: 'Order creation failed' });
        }

        const orderId = result.insertId;

        const mailOptions = {
            subject: `Order Confirmed! #${orderId}`,
            html: `<div style="font-family: Arial, sans-serif; background: #f0f4f8; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 15px; padding: 30px;">
                    <h2 style="color: #2e7d32; text-align: center;">Order Confirmed! ✅</h2>
                    <p style="color: #718096; font-size: 16px;">Thank you, <strong>${customer.name}</strong>!</p>
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <p><strong>Order ID:</strong> #${orderId}</p>
                        <p><strong>Total:</strong> ₹${totalAmount.toFixed(2)}</p>
                        <p><strong>Status:</strong> Pending Payment</p>
                    </div>
                </div></div>`
        };

        sendEmail(customer.email, mailOptions.subject, mailOptions.html)
            .catch(() => console.error('Confirmation email failed'));

        res.status(200).json({
            orderId,
            message: 'Order placed successfully!',
            email_sent: true
        });
    });
});

// GET ORDER STATUS
app.get('/api/order/:orderId', (req, res) => {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) {
        return res.status(400).json({ error: 'Invalid order ID' });
    }

    pool.query('SELECT * FROM orders WHERE id = ?', [orderId], (err, results) => {
        if (err) {
            console.error('Order fetch error:', err.message);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!results || results.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(results[0]);
    });
});

// GET ORDER ITEMS
app.get('/api/order/:orderId/items', (req, res) => {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) {
        return res.status(400).json({ error: 'Invalid order ID' });
    }

    pool.query('SELECT items_json FROM orders WHERE id = ?', [orderId], (err, results) => {
        if (err) {
            console.error('Order items error:', err.message);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!results || results.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        try {
            const items = JSON.parse(results[0].items_json);
            res.json({ orderId, items });
        } catch (e) {
            console.error('JSON parse error:', e);
            res.status(500).json({ error: 'Failed to parse items' });
        }
    });
});

// ADMIN DATA (Protected)
app.get('/api/admin/data', authMiddleware, (req, res) => {
    pool.query('SELECT * FROM orders ORDER BY id DESC LIMIT 100', (err1, orders) => {
        if (err1) {
            console.error('Orders fetch error:', err1.message);
            return res.status(500).json({ error: 'Failed to fetch orders' });
        }

        pool.query('SELECT * FROM subscribers LIMIT 100', (err2, subs) => {
            if (err2) {
                console.error('Subscribers fetch error:', err2.message);
                return res.status(500).json({ error: 'Failed to fetch subscribers' });
            }

            pool.query('SELECT id, name, price, image FROM menu_items ORDER BY id DESC', (err3, menu) => {
                if (err3) {
                    console.error('Menu fetch error:', err3.message);
                    return res.status(500).json({ error: 'Failed to fetch menu' });
                }

                pool.query('SELECT id, name, role, email, salary FROM employees', (err4, employees) => {
                    if (err4) {
                        console.error('Employees fetch error:', err4.message);
                        return res.status(500).json({ error: 'Failed to fetch employees' });
                    }

                    res.json({
                        orders: orders || [],
                        subs: subs || [],
                        menu: menu || [],
                        employees: employees || []
                    });
                });
            });
        });
    });
});

// GET EMPLOYEES
app.get('/api/admin/employees', authMiddleware, (req, res) => {
    pool.query('SELECT id, name, role FROM employees', (err, results) => {
        if (err) {
            console.error('Employees fetch error:', err.message);
            return res.status(500).json({ error: 'Failed to fetch employees' });
        }
        res.json(results || []);
    });
});

// ADD PRODUCT (Protected)
app.post('/api/admin/add-product', authMiddleware, upload.single('image'), (req, res) => {
    const { name, price } = req.body;
    const filename = req.file ? req.file.filename : 'default.jpg';

    if (!validateString(name, 2, 100)) {
        return res.status(400).json({ message: 'Invalid product name' });
    }

    if (!validatePrice(price)) {
        return res.status(400).json({ message: 'Invalid price (0-100000)' });
    }

    pool.query(
        'INSERT INTO menu_items (name, price, image) VALUES (?, ?, ?)',
        [name.trim(), parseFloat(price), filename],
        (err) => {
            if (err) {
                console.error('Product add error:', err.message);
                return res.status(500).json({ message: 'Failed to add product' });
            }
            res.status(200).json({ message: 'Product added successfully!' });
        }
    );
});

// DELETE PRODUCT (Protected)
app.delete('/api/admin/delete-product/:id', authMiddleware, (req, res) => {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
        return res.status(400).json({ message: 'Invalid product ID' });
    }

    pool.query('DELETE FROM menu_items WHERE id = ?', [productId], (err) => {
        if (err) {
            console.error('Product delete error:', err.message);
            return res.status(500).json({ message: 'Failed to delete product' });
        }
        res.status(200).json({ message: 'Product deleted successfully!' });
    });
});

// ADD EMPLOYEE (Protected)
app.post('/api/admin/add-employee', authMiddleware, (req, res) => {
    const { name, role, email, salary } = req.body;

    if (!validateString(name, 2, 100)) {
        return res.status(400).json({ message: 'Invalid employee name' });
    }

    if (!validateString(role, 2, 50)) {
        return res.status(400).json({ message: 'Invalid role' });
    }

    const salaryNum = parseFloat(salary || 0);
    if (isNaN(salaryNum) || salaryNum < 0 || salaryNum > 10000000) {
        return res.status(400).json({ message: 'Invalid salary' });
    }

    const validEmail = email && validateEmail(email) ? email.toLowerCase() : 'N/A';

    pool.query(
        'INSERT INTO employees (name, role, email, salary) VALUES (?, ?, ?, ?)',
        [name.trim(), role.trim(), validEmail, salaryNum],
        (err) => {
            if (err) {
                console.error('Employee add error:', err.message);
                return res.status(500).json({ message: 'Failed to add employee' });
            }
            res.status(200).json({ message: 'Employee added successfully!' });
        }
    );
});

// DELETE EMPLOYEE (Protected)
app.delete('/api/admin/delete-employee/:id', authMiddleware, (req, res) => {
    const employeeId = parseInt(req.params.id);
    if (isNaN(employeeId)) {
        return res.status(400).json({ message: 'Invalid employee ID' });
    }

    pool.query('DELETE FROM employees WHERE id = ?', [employeeId], (err) => {
        if (err) {
            console.error('Employee delete error:', err.message);
            return res.status(500).json({ message: 'Failed to delete employee' });
        }
        res.status(200).json({ message: 'Employee deleted successfully!' });
    });
});

// CONFIRM ORDER (Protected)
app.post('/api/confirm-order', authMiddleware, (req, res) => {
    const { orderId } = req.body;

    const id = parseInt(orderId);
    if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid order ID' });
    }

    pool.query('UPDATE orders SET status = "Confirmed" WHERE id = ?', [id], (err) => {
        if (err) {
            console.error('Confirm order error:', err.message);
            return res.status(500).json({ message: 'Failed to confirm order' });
        }
        res.status(200).json({ message: 'Order confirmed successfully!' });
    });
});

// GET ALL ORDERS (Protected)
app.get('/api/orders/all', authMiddleware, (req, res) => {
    pool.query('SELECT * FROM orders ORDER BY id DESC LIMIT 500', (err, results) => {
        if (err) {
            console.error('Orders fetch error:', err.message);
            return res.status(500).json({ error: 'Failed to fetch orders' });
        }

        const orders = (results || []).map(o => ({
            orderId: o.id,
            customerName: o.customer_name,
            address: o.address,
            total: parseFloat(o.total || 0),
            status: o.status,
            latitude: o.latitude,
            longitude: o.longitude,
            email: o.email,
            createdAt: o.created_at
        }));
        res.json(orders);
    });
});

// GET DELIVERY ORDERS (Protected)
app.get('/api/delivery/orders', authMiddleware, (req, res) => {
    pool.query(
        'SELECT id, customer_name, address, total, latitude, longitude, status FROM orders WHERE status = "Confirmed" ORDER BY id DESC',
        (err, results) => {
            if (err) {
                console.error('Delivery orders error:', err.message);
                return res.status(500).json({ error: 'Failed to fetch orders' });
            }

            const orders = (results || []).map(o => ({
                orderId: o.id,
                customerName: o.customer_name,
                address: o.address,
                total: parseFloat(o.total || 0),
                latitude: o.latitude,
                longitude: o.longitude,
                status: o.status
            }));
            res.json(orders);
        }
    );
});

// UPDATE ORDER STATUS (Protected)
app.post('/api/orders/:orderId/status', authMiddleware, (req, res) => {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) {
        return res.status(400).json({ message: 'Invalid order ID' });
    }

    const { status } = req.body;
    const validStatuses = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];

    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId], (err) => {
        if (err) {
            console.error('Status update error:', err.message);
            return res.status(500).json({ message: 'Failed to update status' });
        }

        if (status === 'Delivered') {
            pool.query('SELECT customer_name, email FROM orders WHERE id = ?', [orderId], (err, results) => {
                if (!err && results && results.length > 0) {
                    const customer = results[0];
                    sendEmail(
                        customer.email,
                        'Order Delivered! 🎉',
                        `<p>Your order #${orderId} has been delivered! Thank you for your purchase.</p>`
                    ).catch(() => console.error('Delivery email failed'));
                }
            });
        }

        res.status(200).json({ message: 'Order status updated!' });
    });
});

// RATE ORDER
app.post('/api/order/rate', (req, res) => {
    const { orderId, rating, feedback } = req.body;

    const id = parseInt(orderId);
    if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid order ID' });
    }

    const ratingNum = parseInt(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ error: 'Rating must be 1-5' });
    }

    const feedbackText = feedback ? feedback.substring(0, 500) : '';

    pool.query(
        'UPDATE orders SET rating = ?, feedback = ? WHERE id = ?',
        [ratingNum, feedbackText, id],
        (err) => {
            if (err) {
                console.error('Rating error:', err.message);
                return res.status(500).json({ error: 'Failed to save rating' });
            }
            res.status(200).json({ message: 'Rating saved!' });
        }
    );
});

// GET BUSINESSES
app.get('/api/businesses', (req, res) => {
    pool.query('SELECT * FROM businesses ORDER BY id DESC', (err, results) => {
        if (err) {
            console.error('Businesses fetch error:', err.message);
            return res.status(500).json({ error: 'Failed to fetch businesses' });
        }
        res.json(results || []);
    });
});

// ADD BUSINESS (Protected)
app.post('/api/admin/add-business', authMiddleware, upload.single('image'), (req, res) => {
    const { shop_name, owner_name, unique_id, address, product_type } = req.body;
    const filename = req.file ? req.file.filename : 'default.jpg';

    if (!validateString(shop_name, 2, 100)) {
        return res.status(400).json({ message: 'Invalid shop name' });
    }

    if (!validateString(owner_name, 2, 100)) {
        return res.status(400).json({ message: 'Invalid owner name' });
    }

    pool.query(
        'INSERT INTO businesses (shop_name, owner_name, unique_id, address, product_type, image) VALUES (?, ?, ?, ?, ?, ?)',
        [shop_name.trim(), owner_name.trim(), unique_id || 'N/A', address || 'N/A', product_type || 'N/A', filename],
        (err) => {
            if (err) {
                console.error('Business add error:', err.message);
                return res.status(500).json({ message: 'Failed to add business' });
            }
            res.status(200).json({ message: 'Business added successfully!' });
        }
    );
});

// DELETE BUSINESS (Protected)
app.delete('/api/admin/delete-business/:id', authMiddleware, (req, res) => {
    const businessId = parseInt(req.params.id);
    if (isNaN(businessId)) {
        return res.status(400).json({ message: 'Invalid business ID' });
    }

    pool.query('DELETE FROM businesses WHERE id = ?', [businessId], (err) => {
        if (err) {
            console.error('Business delete error:', err.message);
            return res.status(500).json({ message: 'Failed to delete business' });
        }
        res.status(200).json({ message: 'Business deleted successfully!' });
    });
});

// HEALTH CHECK
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// ========== ERROR HANDLING ==========

app.use((err, req, res, next) => {
    console.error('Error:', err);

    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Invalid JSON' });
    }

    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler — only for /api/* routes; everything else falls through to static files / index.html
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Anything else not matched by static files -> serve index.html (so direct links still work)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`   Open http://localhost:${PORT}/shop.html in your browser.`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received');
    pool.end();
    process.exit(0);
});