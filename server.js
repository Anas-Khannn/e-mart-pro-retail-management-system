// E-Mart Management System - Node.js Express Server
const express = require('express');
const compression = require('compression');
const session = require('express-session');
const mysql = require('./database/db');
const dbInit = require('./database/init');
const MySQLSessionStore = require('./database/session-store');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('./config/env');

const app = express();
const PORT = process.env.PORT || 3000;
let dbReadyPromise = null;

function initializeAppDatabase() {
  if (!dbReadyPromise) {
    dbReadyPromise = dbInit();
  }
  return dbReadyPromise;
}

// Gzip compression for all responses
app.use(compression());

// Simple in-memory rate limiter
const rateLimitStore = new Map();
function rateLimit(maxRequests, windowMs) {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const record = rateLimitStore.get(key);
    if (!record || now - record.start > windowMs) {
      rateLimitStore.set(key, { start: now, count: 1 });
      return next();
    }
    record.count++;
    if (record.count > maxRequests) {
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }
    next();
  };
}

// Cleanup expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore) {
    if (now - record.start > 60000) rateLimitStore.delete(key);
  }
}, 300000);

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.VERCEL) {
  app.use(async (req, res, next) => {
    if (!req.path.startsWith('/api')) {
      return next();
    }

    try {
      await initializeAppDatabase();
      next();
    } catch (err) {
      console.error('[DB Init Error] Critical setup failure:', err);
      res.status(500).json({ message: 'Database initialization failed.' });
    }
  });
}

app.set('trust proxy', 1);

// Express Session Config
app.use(session({
  name: 'emart.sid',
  secret: process.env.SESSION_SECRET || 'emart_session_secret_2026_x78',
  store: new MySQLSessionStore(),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL),
    maxAge: 1000 * 60 * 60 * 8 // 8 hours session life
  }
}));

// Create upload directories if not exist
const uploadsDir = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Storage config for product images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const prefix = file.fieldname === 'profile_image' ? 'profile' : 'product';
    cb(null, `${prefix}-` + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files (jpg, png, gif, webp) are allowed!'));
  }
});

// Serve static assets with cache headers
app.use('/css', express.static(path.join(__dirname, 'css'), { maxAge: '7d', immutable: true }));
app.use('/js', express.static(path.join(__dirname, 'js'), { maxAge: '7d', immutable: true }));
app.use('/images', express.static(path.join(__dirname, 'images'), { maxAge: '1d' }));
app.use('/uploads', express.static(uploadsDir, { maxAge: '1d' }));

// Root route serves landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Authentication Middleware
const requireAuth = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.status(401).json({ message: 'Unauthorized: Session expired or invalid.' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden: Admin privileges required.' });
  }
};

const requirePageAuth = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/pages/login.html');
  }
};

const requireAdminPage = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    next();
  } else if (req.session.user) {
    res.redirect('/dashboard/index.html');
  } else {
    res.redirect('/pages/login.html');
  }
};

// Public auth pages
app.get('/pages/login.html', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'login.html')));
app.get('/pages/signup.html', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'signup.html')));
app.get('/pages/forgot-password.html', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'forgot-password.html')));

// Protected app pages
app.get('/dashboard/index.html', requirePageAuth, (req, res) => res.sendFile(path.join(__dirname, 'dashboard', 'index.html')));
app.get('/pages/pos.html', requirePageAuth, (req, res) => res.sendFile(path.join(__dirname, 'pages', 'pos.html')));
app.get('/pages/products.html', requirePageAuth, (req, res) => res.sendFile(path.join(__dirname, 'pages', 'products.html')));
app.get('/pages/customers.html', requirePageAuth, (req, res) => res.sendFile(path.join(__dirname, 'pages', 'customers.html')));
app.get('/pages/reports.html', requirePageAuth, (req, res) => res.sendFile(path.join(__dirname, 'pages', 'reports.html')));
app.get('/pages/settings.html', requireAdminPage, (req, res) => res.sendFile(path.join(__dirname, 'pages', 'settings.html')));
app.get('/pages/users.html', requireAdminPage, (req, res) => res.sendFile(path.join(__dirname, 'pages', 'users.html')));

/* ==========================================================================
   1. AUTHENTICATION MODULE API
   ========================================================================== */

// Signup API
app.post('/api/auth/signup', rateLimit(10, 60000), upload.single('profile_image'), async (req, res) => {
  const { full_name, email, phone, password, role } = req.body;

  if (!full_name || !email || !password || !phone || !role) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  if (!['admin', 'shopkeeper'].includes(role)) {
    return res.status(400).json({ message: 'Please choose a valid account role.' });
  }

  try {
    // Check if email already registered
    const [existing] = await mysql.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email address is already in use.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const profileImageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    
    // Insert user
    await mysql.query(
      'INSERT INTO users (full_name, email, phone, password_hash, role, status, profile_image_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [full_name, email, phone, hashedPassword, role, 'active', profileImageUrl]
    );

    // Activity Log
    await mysql.query('INSERT INTO activity_logs (action, details) VALUES (?, ?)', 
      ['User Registration', `New ${role} registered: ${email}`]);

    res.status(201).json({ success: true, message: 'Account registered successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Email address is already in use.' });
    }
    console.error('Signup API error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Login API
app.post('/api/auth/login', rateLimit(10, 60000), async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const [users] = await mysql.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const user = users[0];

    // Check status
    if (user.status === 'inactive') {
      return res.status(403).json({ message: 'Account is deactivated. Contact Admin.' });
    }

    // Verify password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const sessionUser = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      profile_image_url: user.profile_image_url
    };

    req.session.regenerate((sessionErr) => {
      if (sessionErr) {
        console.error('Session regeneration error:', sessionErr);
        return res.status(500).json({ message: 'Could not start login session.' });
      }

      req.session.user = sessionUser;

      req.session.save(async (saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.status(500).json({ message: 'Could not save login session.' });
        }

        try {
          // Log Activity
          await mysql.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
            [user.id, 'User Login', `${user.full_name} logged in successfully.`]);
        } catch (logError) {
          console.error('Login logging error:', logError);
        }

        res.json({
          success: true,
          message: 'Login successful.',
          user: {
            id: user.id,
            full_name: user.full_name,
            role: user.role,
            profile_image_url: user.profile_image_url
          }
        });
      });
    });
  } catch (error) {
    console.error('Login API error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Logout API
app.post('/api/auth/logout', (req, res) => {
  if (req.session.user) {
    const userId = req.session.user.id;
    const userName = req.session.user.full_name;
    req.session.destroy(async (err) => {
      if (err) {
        return res.status(500).json({ message: 'Could not log out.' });
      }
      try {
        await mysql.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)', 
          [userId, 'User Logout', `${userName} logged out.`]);
      } catch (e) {
        console.error('Logout logging error:', e);
      }
      res.json({ message: 'Logged out successfully.' });
    });
  } else {
    res.json({ message: 'No active session.' });
  }
});

// Check Session / Current User
app.get('/api/auth/me', (req, res) => {
  if (req.session.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

// Simulated Forgot Password OTP Generator
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email address is required.' });

  try {
    const [users] = await mysql.query('SELECT id FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ message: 'No registered account found with this email.' });
    }

    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    req.session.forgotPasswordOtp = {
      email,
      code: otpCode,
      expires: Date.now() + (1000 * 60 * 10) // 10 minutes expiry
    };

    res.json({ success: true, otp: otpCode, message: 'OTP sent successfully (Simulated).' });
  } catch (error) {
    res.status(500).json({ message: 'Server error processing request.' });
  }
});

// Reset Password API
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, otp, password } = req.body;

  if (!email || !otp || !password) {
    return res.status(400).json({ message: 'Email, OTP, and password are required.' });
  }

  const record = req.session.forgotPasswordOtp;
  if (!record || record.email !== email || record.code !== otp || Date.now() > record.expires) {
    return res.status(400).json({ message: 'Invalid or expired verification session.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await mysql.query('UPDATE users SET password_hash = ? WHERE email = ?', [hashedPassword, email]);

    // Clear OTP session
    req.session.forgotPasswordOtp = null;

    // Log Activity
    await mysql.query('INSERT INTO activity_logs (action, details) VALUES (?, ?)', 
      ['Password Reset', `Password reset successful for ${email}`]);

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating database.' });
  }
});

/* ==========================================================================
   2. DASHBOARD OVERVIEW API
   ========================================================================== */

app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const [stats] = await mysql.query(`
      SELECT
        (SELECT IFNULL(SUM(total_amount), 0) FROM sales WHERE status = 'completed') AS totalRevenue,
        (SELECT COUNT(*) FROM sales WHERE status = 'completed') AS totalSales,
        (SELECT COUNT(*) FROM products) AS totalProducts,
        (SELECT COUNT(*) FROM customers WHERE name != 'Walking Customer') AS totalCustomers,
        (SELECT COUNT(*) FROM sales) AS totalOrders,
        (SELECT COUNT(*) FROM products WHERE quantity > 0 AND quantity <= min_stock) AS lowStockCount,
        (SELECT COUNT(*) FROM products WHERE quantity = 0) AS outOfStockCount
    `);

    res.json(stats[0]);
  } catch (error) {
    console.error('Stats query error:', error);
    res.status(500).json({ message: 'Error retrieving stats.' });
  }
});

app.get('/api/dashboard/details', requireAuth, async (req, res) => {
  try {
    const [[recentSales], [topProducts], [categoriesInventory], [stockAlerts]] = await Promise.all([
      mysql.query(`
        SELECT s.id, s.invoice_number, s.total_amount, s.payment_method, s.sale_date, c.name AS customer_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        ORDER BY s.sale_date DESC
        LIMIT 5
      `),
      mysql.query(`
        SELECT p.name, p.sku, SUM(si.quantity) AS sold_qty, SUM(si.subtotal) AS revenue
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        GROUP BY p.id
        ORDER BY sold_qty DESC
        LIMIT 5
      `),
      mysql.query(`
        SELECT c.name, COUNT(p.id) AS product_count, SUM(p.quantity) AS stock_total
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id
        GROUP BY c.id
      `),
      mysql.query(`
        SELECT 
          p.id, p.name, p.sku, p.quantity, p.min_stock,
          IFNULL(SUM(si.quantity), 0) / 30.0 AS avg_daily_sales
        FROM products p
        LEFT JOIN sale_items si ON p.id = si.product_id
        LEFT JOIN sales s ON si.sale_id = s.id AND s.sale_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND s.status = 'completed'
        WHERE p.quantity <= p.min_stock
        GROUP BY p.id
        ORDER BY p.quantity ASC
      `)
    ]);

    const alerts = stockAlerts.map(alert => {
      const qty = alert.quantity;
      const minStock = alert.min_stock;
      const avgSales = parseFloat(alert.avg_daily_sales) || 0;
      let restockMsg = 'No recent sales';
      let daysRemaining = null;

      if (qty === 0) {
        restockMsg = 'Recommended Restock: Immediately';
        daysRemaining = 0;
      } else if (avgSales > 0) {
        daysRemaining = Math.round(qty / avgSales);
        restockMsg = `Recommended Restock in ${daysRemaining} Days`;
      }

      return {
        id: alert.id,
        name: alert.name,
        sku: alert.sku,
        quantity: qty,
        min_stock: minStock,
        avg_daily_sales: avgSales,
        days_remaining: daysRemaining,
        restock_message: restockMsg
      };
    });

    res.json({
      recentSales,
      topProducts,
      categoriesInventory,
      alerts
    });
  } catch (error) {
    console.error('Dashboard details error:', error);
    res.status(500).json({ message: 'Error fetching charts details.' });
  }
});

/* ==========================================================================
   3. PRODUCT INVENTORY MODULE API (CRUD)
   ========================================================================== */

// Get Products
app.get('/api/products', requireAuth, async (req, res) => {
  const { search, category_id, supplier_id, stock_status, sort_by, sort_order, page, limit } = req.query;
  const pLimit = parseInt(limit) || 10;
  const pOffset = ((parseInt(page) || 1) - 1) * pLimit;

  let query = `
    SELECT p.*, c.name AS category_name, s.name AS supplier_name,
           IFNULL(SUM(si.quantity), 0) / 30.0 AS avg_daily_sales
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN sale_items si ON p.id = si.product_id
    LEFT JOIN sales sa ON si.sale_id = sa.id AND sa.sale_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND sa.status = 'completed'
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    query += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (category_id) {
    query += ' AND p.category_id = ?';
    params.push(category_id);
  }

  if (supplier_id) {
    query += ' AND p.supplier_id = ?';
    params.push(supplier_id);
  }

  if (stock_status === 'in_stock') {
    query += ' AND p.quantity > p.min_stock';
  } else if (stock_status === 'low_stock') {
    query += ' AND p.quantity > 0 AND p.quantity <= p.min_stock';
  } else if (stock_status === 'out_of_stock') {
    query += ' AND p.quantity = 0';
  }

  query += ' GROUP BY p.id';

  // Sorting
  const allowedSortCols = ['name', 'sku', 'selling_price', 'quantity', 'created_at'];
  const sortCol = allowedSortCols.includes(sort_by) ? sort_by : 'created_at';
  const order = sort_order === 'asc' ? 'ASC' : 'DESC';
  query += ` ORDER BY p.${sortCol} ${order}`;

  // Paginated queries need limits
  let countQuery = `SELECT COUNT(*) AS total FROM (${query}) AS sub`;
  
  query += ' LIMIT ? OFFSET ?';
  // Standard mysql driver accepts integers, connection.query requires numbers or will stringify them
  params.push(pLimit, pOffset);

  try {
    const [totalRes] = await mysql.query(countQuery, params.slice(0, -2));
    const [products] = await mysql.query(query, params);

    res.json({
      total: totalRes[0].total,
      limit: pLimit,
      page: parseInt(page) || 1,
      products
    });
  } catch (err) {
    console.error('Products fetch error:', err);
    res.status(500).json({ message: 'Error loading products catalog.' });
  }
});

// Add Product with Image
app.post('/api/products', requireAuth, upload.single('product_image'), async (req, res) => {
  const { name, sku, category_id, purchase_price, selling_price, quantity, min_stock, supplier_id } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : '/images/placeholder-product.png';

  if (!name || !sku || !purchase_price || !selling_price || quantity === undefined) {
    return res.status(400).json({ message: 'Name, SKU, prices, and quantity are required.' });
  }

  const minStockVal = min_stock !== undefined ? parseInt(min_stock) : 5;

  try {
    // Check if SKU exists
    const [existing] = await mysql.query('SELECT id FROM products WHERE sku = ?', [sku]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'A product with this SKU code already exists.' });
    }

    const [result] = await mysql.query(`
      INSERT INTO products (name, sku, category_id, purchase_price, selling_price, quantity, min_stock, supplier_id, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, sku, category_id || null, purchase_price, selling_price, quantity, minStockVal, supplier_id || null, image_url]);

    await mysql.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)', 
      [req.session.user.id, 'Add Product', `Added product SKU: ${sku} - ${name} x${quantity}`]);

    res.status(201).json({ success: true, productId: result.insertId, message: 'Product added successfully.' });
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ message: 'Database error adding product.' });
  }
});

// Update Product
app.put('/api/products/:id', requireAuth, upload.single('product_image'), async (req, res) => {
  const { id } = req.params;
  const { name, sku, category_id, purchase_price, selling_price, quantity, min_stock, supplier_id } = req.body;

  try {
    // Check product exists
    const [current] = await mysql.query('SELECT * FROM products WHERE id = ?', [id]);
    if (current.length === 0) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    // If sku changed, check unique
    if (sku !== current[0].sku) {
      const [existing] = await mysql.query('SELECT id FROM products WHERE sku = ? AND id != ?', [sku, id]);
      if (existing.length > 0) {
        return res.status(400).json({ message: 'SKU code is already in use by another product.' });
      }
    }

    let image_url = current[0].image_url;
    if (req.file) {
      image_url = `/uploads/${req.file.filename}`;
    }

    const minStockVal = min_stock !== undefined ? parseInt(min_stock) : 5;

    await mysql.query(`
      UPDATE products 
      SET name = ?, sku = ?, category_id = ?, purchase_price = ?, selling_price = ?, quantity = ?, min_stock = ?, supplier_id = ?, image_url = ?
      WHERE id = ?
    `, [name, sku, category_id || null, purchase_price, selling_price, quantity, minStockVal, supplier_id || null, image_url, id]);

    await mysql.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)', 
      [req.session.user.id, 'Update Product', `Updated product ID: ${id} - SKU: ${sku}`]);

    res.json({ success: true, message: 'Product updated successfully.' });
  } catch (err) {
    console.error('Product update error:', err);
    res.status(500).json({ message: 'Database error updating product.' });
  }
});

// Delete Product
app.delete('/api/products/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const [current] = await mysql.query('SELECT name, sku FROM products WHERE id = ?', [id]);
    if (current.length === 0) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    await mysql.query('DELETE FROM products WHERE id = ?', [id]);

    await mysql.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)', 
      [req.session.user.id, 'Delete Product', `Deleted product: ${current[0].name} (${current[0].sku})`]);

    res.json({ success: true, message: 'Product deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete product. It may be linked to transaction invoices.' });
  }
});

// Get Categories and Suppliers simple list
app.get('/api/categories', requireAuth, async (req, res) => {
  try {
    const [categories] = await mysql.query('SELECT * FROM categories ORDER BY name ASC');
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: 'Error loading categories.' });
  }
});

app.get('/api/suppliers', requireAuth, async (req, res) => {
  try {
    const [suppliers] = await mysql.query('SELECT * FROM suppliers ORDER BY name ASC');
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ message: 'Error loading suppliers.' });
  }
});

/* ==========================================================================
   4. POINT OF SALE (POS) API
   ========================================================================== */

// POS Product Quick Search
app.get('/api/pos/products', requireAuth, async (req, res) => {
  const { query, category_id } = req.query;
  let sql = `
    SELECT p.id, p.name, p.sku, p.category_id, c.name AS category_name, p.selling_price, p.quantity, p.min_stock, p.image_url
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.quantity > 0
  `;
  const params = [];

  if (query) {
    sql += ' AND (p.name LIKE ? OR p.sku = ?)';
    params.push(`%${query}%`, query);
  }

  if (category_id) {
    sql += ' AND p.category_id = ?';
    params.push(category_id);
  }

  sql += ' LIMIT 24';

  try {
    const [products] = await mysql.query(sql, params);
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'POS product search error.' });
  }
});

// POS Checkout / Process Transaction
app.post('/api/pos/checkout', requireAuth, async (req, res) => {
  const { customer_id, items, discount, tax, payment_method } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'Cart items cannot be empty.' });
  }

  let subtotal = 0;
  try {
    const conn = await mysql.getConnection();
    await conn.beginTransaction();

    try {
      const productIds = items.map(item => item.id);
      const [prodRecords] = await conn.query(
        `SELECT id, selling_price, quantity, name FROM products WHERE id IN (?)`,
        [productIds]
      );

      const productMap = {};
      for (const prod of prodRecords) {
        productMap[prod.id] = prod;
      }

      const itemDetails = [];
      for (const item of items) {
        const prod = productMap[item.id];
        if (!prod) throw new Error(`Product ID ${item.id} not found.`);
        if (prod.quantity <= 0) throw new Error(`Product ${prod.name} is out of stock.`);
        if (prod.quantity < item.quantity) {
          throw new Error(`Insufficient stock for product: ${prod.name}. Available: ${prod.quantity}. Required: ${item.quantity}.`);
        }
        subtotal += parseFloat(prod.selling_price) * item.quantity;
        itemDetails.push({ ...item, price: prod.selling_price });
      }

      const taxRate = parseFloat(tax) || 0;
      const discountVal = parseFloat(discount) || 0;
      const taxAmount = subtotal * (taxRate / 100);
      const totalAmount = subtotal + taxAmount - discountVal;

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randHex = Math.floor(1000 + Math.random() * 9000).toString();
      const invoiceNumber = `INV-${dateStr}-${randHex}`;

      const [saleRes] = await conn.query(`
        INSERT INTO sales (invoice_number, customer_id, user_id, subtotal, discount, tax, total_amount, payment_method, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed')
      `, [invoiceNumber, customer_id || null, req.session.user.id, subtotal, discountVal, taxAmount, totalAmount, payment_method]);

      const saleId = saleRes.insertId;

      const saleItemValues = itemDetails.map(item => {
        const itemSubtotal = parseFloat(item.price) * item.quantity;
        return [saleId, item.id, item.quantity, item.price, itemSubtotal];
      });

      await conn.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal) VALUES ?`,
        [saleItemValues]
      );

      if (customer_id && customer_id > 1) {
        const loyaltyPointsAdded = Math.floor(totalAmount * 0.1);
        await conn.query('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?', [loyaltyPointsAdded, customer_id]);
      }

      await conn.query('INSERT INTO invoices (sale_id, invoice_number) VALUES (?, ?)', [saleId, invoiceNumber]);

      await conn.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)', 
        [req.session.user.id, 'POS checkout', `Created Invoice: ${invoiceNumber}. Total: $${totalAmount.toFixed(2)}`]);

      await conn.commit();
      conn.release();

      res.status(201).json({
        success: true,
        invoiceNumber,
        saleId,
        totalAmount,
        message: 'Transaction completed successfully.'
      });

    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (error) {
    console.error('POS Checkout Transaction failed:', error);
    res.status(400).json({ message: error.message || 'Transaction failed.' });
  }
});

// Print/Get Invoice Details
app.get('/api/pos/invoice/:invoiceNumber', requireAuth, async (req, res) => {
  const { invoiceNumber } = req.params;

  try {
    const [sales] = await mysql.query(`
      SELECT s.*, c.name AS customer_name, u.full_name AS cashier_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.invoice_number = ?
    `, [invoiceNumber]);

    if (sales.length === 0) {
      return res.status(404).json({ message: 'Invoice not found.' });
    }

    const sale = sales[0];

    const [items] = await mysql.query(`
      SELECT si.*, p.name AS product_name, p.sku
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `, [sale.id]);

    res.json({
      sale,
      items
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving invoice.' });
  }
});

/* ==========================================================================
   5. CRM CUSTOMERS MODULE API
   ========================================================================== */

// Get Customers
app.get('/api/customers', requireAuth, async (req, res) => {
  const { search, page, limit } = req.query;
  const cLimit = parseInt(limit) || 10;
  const cOffset = ((parseInt(page) || 1) - 1) * cLimit;

  let query = 'SELECT * FROM customers WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY created_at DESC';

  const countQuery = `SELECT COUNT(*) AS total FROM (${query}) AS sub`;
  query += ' LIMIT ? OFFSET ?';
  params.push(cLimit, cOffset);

  try {
    const [totalRes] = await mysql.query(countQuery, params.slice(0, -2));
    const [customers] = await mysql.query(query, params);

    res.json({
      total: totalRes[0].total,
      limit: cLimit,
      page: parseInt(page) || 1,
      customers
    });
  } catch (error) {
    res.status(500).json({ message: 'Error loading customers CRM.' });
  }
});

// Get Customer Profile Details
app.get('/api/customers/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const [customer] = await mysql.query('SELECT * FROM customers WHERE id = ?', [id]);
    if (customer.length === 0) return res.status(404).json({ message: 'Customer not found.' });

    // Purchase history totals
    const [historySum] = await mysql.query(`
      SELECT COUNT(id) AS orders_count, SUM(total_amount) AS spending
      FROM sales
      WHERE customer_id = ? AND status = 'completed'
    `, [id]);

    // Order list
    const [orders] = await mysql.query(`
      SELECT invoice_number, total_amount, sale_date, payment_method, status
      FROM sales
      WHERE customer_id = ?
      ORDER BY sale_date DESC
      LIMIT 10
    `, [id]);

    res.json({
      customer: customer[0],
      stats: {
        orders_count: historySum[0].orders_count || 0,
        total_spending: historySum[0].spending || 0
      },
      orders
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile.' });
  }
});

// Add Customer
app.post('/api/customers', requireAuth, async (req, res) => {
  const { name, email, phone, address } = req.body;
  if (!name || !phone) return res.status(400).json({ message: 'Name and Phone number are required.' });

  try {
    const [existing] = await mysql.query('SELECT id FROM customers WHERE phone = ?', [phone]);
    if (existing.length > 0) return res.status(400).json({ message: 'A customer with this phone number already exists.' });

    const [result] = await mysql.query(`
      INSERT INTO customers (name, email, phone, address, loyalty_points)
      VALUES (?, ?, ?, ?, 0)
    `, [name, email || null, phone, address || null]);

    res.status(201).json({ success: true, customerId: result.insertId, message: 'Customer added successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error adding customer.' });
  }
});

// Update Customer
app.put('/api/customers/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, address } = req.body;

  try {
    const [current] = await mysql.query('SELECT phone FROM customers WHERE id = ?', [id]);
    if (current.length === 0) return res.status(404).json({ message: 'Customer not found.' });

    if (phone !== current[0].phone) {
      const [existing] = await mysql.query('SELECT id FROM customers WHERE phone = ? AND id != ?', [phone, id]);
      if (existing.length > 0) return res.status(400).json({ message: 'Phone number already in use.' });
    }

    await mysql.query(`
      UPDATE customers SET name = ?, email = ?, phone = ?, address = ?
      WHERE id = ?
    `, [name, email || null, phone, address || null, id]);

    res.json({ success: true, message: 'Customer updated successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating customer.' });
  }
});

// Delete Customer
app.delete('/api/customers/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (id == 1) return res.status(400).json({ message: 'Cannot delete Walking Customer placeholder.' });

  try {
    await mysql.query('DELETE FROM customers WHERE id = ?', [id]);
    res.json({ success: true, message: 'Customer deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Cannot delete customer. They have transaction records.' });
  }
});

/* ==========================================================================
   6. VISUAL REPORTS MODULE API
   ========================================================================== */

app.get('/api/reports/analytics', requireAuth, async (req, res) => {
  const { type } = req.query;

  try {
    let salesQuery = '';
    
    if (type === 'daily') {
      salesQuery = `
        SELECT DATE_FORMAT(sale_date, '%Y-%m-%d') AS label, SUM(total_amount) AS value, COUNT(id) AS sales_count
        FROM sales
        WHERE status = 'completed' AND sale_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY label
        ORDER BY label ASC
      `;
    } else if (type === 'weekly') {
      salesQuery = `
        SELECT CONCAT('Week ', WEEK(sale_date)) AS label, SUM(total_amount) AS value, COUNT(id) AS sales_count
        FROM sales
        WHERE status = 'completed' AND sale_date >= DATE_SUB(NOW(), INTERVAL 12 WEEK)
        GROUP BY label
        ORDER BY label ASC
      `;
    } else if (type === 'yearly') {
      salesQuery = `
        SELECT DATE_FORMAT(sale_date, '%Y') AS label, SUM(total_amount) AS value, COUNT(id) AS sales_count
        FROM sales
        WHERE status = 'completed'
        GROUP BY label
        ORDER BY label ASC
      `;
    } else {
      salesQuery = `
        SELECT DATE_FORMAT(sale_date, '%Y-%m') AS label, SUM(total_amount) AS value, COUNT(id) AS sales_count
        FROM sales
        WHERE status = 'completed' AND sale_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY label
        ORDER BY label ASC
      `;
    }

    const [[salesAnalytics], [lowStockProducts], [outOfStockProducts], [topCustomers], [customerGrowth]] = await Promise.all([
      mysql.query(salesQuery),
      mysql.query('SELECT name, sku, quantity, selling_price FROM products WHERE quantity < 15 ORDER BY quantity ASC'),
      mysql.query('SELECT name, sku, quantity, selling_price FROM products WHERE quantity = 0'),
      mysql.query(`
        SELECT c.name, c.phone, SUM(s.total_amount) AS total_spent, COUNT(s.id) AS order_count
        FROM sales s
        JOIN customers c ON s.customer_id = c.id
        WHERE s.status = 'completed' AND c.name != 'Walking Customer'
        GROUP BY c.id
        ORDER BY total_spent DESC
        LIMIT 10
      `),
      mysql.query(`
        SELECT DATE_FORMAT(created_at, '%Y-%m') AS label, COUNT(id) AS value
        FROM customers
        WHERE name != 'Walking Customer'
        GROUP BY label
        ORDER BY label ASC
        LIMIT 12
      `)
    ]);

    res.json({
      sales: salesAnalytics,
      inventory: {
        low: lowStockProducts,
        out: outOfStockProducts
      },
      customers: {
        top: topCustomers,
        growth: customerGrowth
      }
    });

  } catch (error) {
    console.error('Reports endpoint error:', error);
    res.status(500).json({ message: 'Error retrieving analytics reports.' });
  }
});

/* ==========================================================================
   7. STORE SETTINGS MODULE API
   ========================================================================== */

app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const [settings] = await mysql.query('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
    if (settings.length === 0) {
      return res.json({ store_name: 'E-Mart', currency: '$', tax_percentage: 0 });
    }
    res.json(settings[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving store settings.' });
  }
});

app.post('/api/settings', requireAdmin, upload.single('logo'), async (req, res) => {
  const { store_name, address, phone, email, currency, tax_percentage } = req.body;

  try {
    const [existing] = await mysql.query('SELECT id, logo_url FROM settings ORDER BY id DESC LIMIT 1');
    let logo_url = existing.length > 0 ? existing[0].logo_url : '/images/logo.png';
    if (req.file) {
      logo_url = `/uploads/${req.file.filename}`;
    }

    if (existing.length > 0) {
      await mysql.query(`
        UPDATE settings 
        SET store_name = ?, address = ?, phone = ?, email = ?, currency = ?, tax_percentage = ?, logo_url = ?
        WHERE id = ?
      `, [store_name, address, phone, email, currency, tax_percentage, logo_url, existing[0].id]);
    } else {
      await mysql.query(`
        INSERT INTO settings (store_name, address, phone, email, currency, tax_percentage, logo_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [store_name, address, phone, email, currency, tax_percentage, logo_url]);
    }

    res.json({ success: true, message: 'Store configurations updated successfully.' });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ message: 'Error updating store settings.' });
  }
});

/* ==========================================================================
   8. ADMIN STAFF USER MANAGEMENT API
   ========================================================================== */

app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    // Return all users, excluding password hashes
    const [users] = await mysql.query('SELECT id, full_name, email, phone, role, status, created_at FROM users ORDER BY created_at DESC');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving users.' });
  }
});

app.post('/api/users', requireAdmin, async (req, res) => {
  const { full_name, email, phone, role, password } = req.body;

  if (!full_name || !email || !password || !phone || !role) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const [existing] = await mysql.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email is already in use.' });
    }

    const hash = await bcrypt.hash(password, 10);
    await mysql.query(`
      INSERT INTO users (full_name, email, phone, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `, [full_name, email, phone, hash, role]);

    res.status(201).json({ success: true, message: 'User added successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user.' });
  }
});

app.put('/api/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { full_name, email, phone, role } = req.body;

  try {
    const [existing] = await mysql.query('SELECT email FROM users WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'User not found.' });

    if (email !== existing[0].email) {
      const [duplicate] = await mysql.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
      if (duplicate.length > 0) return res.status(400).json({ message: 'Email address is already in use.' });
    }

    await mysql.query(`
      UPDATE users SET full_name = ?, email = ?, phone = ?, role = ?
      WHERE id = ?
    `, [full_name, email, phone, role, id]);

    res.json({ success: true, message: 'User updated successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user.' });
  }
});

// Update Status (Activate/Deactivate)
app.patch('/api/users/:id/status', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // active or inactive

  if (id == req.session.user.id) {
    return res.status(400).json({ message: 'You cannot change your own status.' });
  }

  try {
    await mysql.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: `User status changed to ${status}.` });
  } catch (error) {
    res.status(500).json({ message: 'Error changing user status.' });
  }
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  if (id == req.session.user.id) {
    return res.status(400).json({ message: 'You cannot delete yourself.' });
  }

  try {
    await mysql.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Cannot delete user. They are linked to transaction activity logs.' });
  }
});

/* ==========================================================================
   SERVER INITIALIZATION
   ========================================================================== */

// Initialize Database then start server
if (require.main === module) {
  initializeAppDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Server] E-Mart server running successfully at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[DB Init Error] Critical setup failure:', err);
    process.exit(1);
  });
}

module.exports = app;
