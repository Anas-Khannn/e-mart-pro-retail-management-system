-- MySQL Database Schema for E-Mart Management System

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  phone VARCHAR(20) NULL,
  password_hash VARCHAR(255) NOT NULL,
  profile_image_url VARCHAR(255) NULL,
  role ENUM('admin', 'shopkeeper') NOT NULL DEFAULT 'shopkeeper',
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  phone VARCHAR(20) NULL,
  email VARCHAR(100) NULL,
  address TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Products Table
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  sku VARCHAR(50) NOT NULL UNIQUE,
  category_id INT NULL,
  purchase_price DECIMAL(10, 2) NOT NULL,
  selling_price DECIMAL(10, 2) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  min_stock INT NOT NULL DEFAULT 5,
  supplier_id INT NULL,
  image_url VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- 5. Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  address TEXT NULL,
  loyalty_points INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 6. Sales Table
CREATE TABLE IF NOT EXISTS sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  customer_id INT NULL,
  user_id INT NULL,
  sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  subtotal DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0.00,
  tax DECIMAL(10, 2) DEFAULT 0.00,
  total_amount DECIMAL(10, 2) NOT NULL,
  payment_method ENUM('cash', 'card', 'online') NOT NULL DEFAULT 'cash',
  status ENUM('completed', 'refunded', 'cancelled') NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 7. Sale Items Table
CREATE TABLE IF NOT EXISTS sale_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  product_id INT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- 8. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL UNIQUE,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  file_path VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

-- 9. Settings Table
CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  store_name VARCHAR(100) NOT NULL DEFAULT 'E-Mart',
  logo_url VARCHAR(255) NULL,
  address TEXT NULL,
  phone VARCHAR(20) NULL,
  email VARCHAR(100) NULL,
  currency VARCHAR(10) DEFAULT '$',
  tax_percentage DECIMAL(5, 2) DEFAULT 0.00,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 10. Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 11. Express Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  expires BIGINT UNSIGNED NOT NULL,
  data LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sessions_expires (expires)
);

-- Triggers to automatically decrease product quantities on successful checkouts
DROP TRIGGER IF EXISTS after_sale_item_insert;

CREATE TRIGGER after_sale_item_insert
AFTER INSERT ON sale_items
FOR EACH ROW
UPDATE products
SET quantity = quantity - NEW.quantity
WHERE id = NEW.product_id;

-- Seeding default Admin and Shopkeeper
-- Default password for both is 'admin123'
-- Hashed using bcryptjs ($2b$10$cCCLL6/4ZApHHyBQIGFkYuPSoT.jymTNNQ2AVl34/i0K4pOT57r2m)
INSERT IGNORE INTO users (full_name, email, phone, password_hash, role, status) VALUES 
('System Admin', 'admin@emart.com', '+1234567890', '$2b$10$cCCLL6/4ZApHHyBQIGFkYuPSoT.jymTNNQ2AVl34/i0K4pOT57r2m', 'admin', 'active'),
('John Shopkeeper', 'shopkeeper@emart.com', '+1987654321', '$2b$10$cCCLL6/4ZApHHyBQIGFkYuPSoT.jymTNNQ2AVl34/i0K4pOT57r2m', 'shopkeeper', 'active');

-- Seeding categories
INSERT IGNORE INTO categories (name, description) VALUES
('Groceries', 'Daily food items, produce, beverages, and household needs'),
('Electronics', 'Gadgets, phone accessories, computers, and electric appliances'),
('Clothing', 'Men, women, and children fashion garments'),
('Home & Living', 'Furniture, decor, kitchen utilities, and bedding items'),
('Pharmacy', 'Over-the-counter medicines, vitamins, and healthcare products');

-- Seeding suppliers
INSERT IGNORE INTO suppliers (name, phone, email, address) VALUES
('Global Foods Distributors', '+18005550199', 'info@globalfoods.com', '100 Distribution Way, NJ'),
('TechZone Wholesale', '+18005550188', 'sales@techzone.com', '500 Silicon Alley, CA'),
('Aura Fashion Inc.', '+18005550177', 'contact@aurafashion.com', '23 Garment District, NY');

-- Seeding default/walk-in customers
INSERT IGNORE INTO customers (name, email, phone, address, loyalty_points) VALUES
('Walking Customer', 'walkin@emart.com', '0000000000', 'In-Store Walk-in', 0),
('Jane Miller', 'jane.miller@gmail.com', '5551234567', '782 Maple St, Cityville', 150),
('David Smith', 'david.smith@yahoo.com', '5559876543', '432 Oak Rd, Metroville', 85);

-- Seeding initial products
INSERT IGNORE INTO products (name, sku, category_id, purchase_price, selling_price, quantity, min_stock, supplier_id, image_url) VALUES
('Organic Whole Milk 1 Gallon', 'GR-MILK-001', 1, 2.50, 3.99, 100, 10, 1, '/uploads/milk.png'),
('Premium Basmati Rice 5kg', 'GR-RICE-002', 1, 8.00, 12.49, 8, 10, 1, '/uploads/rice.png'),
('Wireless Bluetooth Earbuds', 'EL-EAR-003', 2, 12.00, 24.99, 0, 5, 2, '/uploads/earbuds.png'),
('USB-C Fast Charger Block 20W', 'EL-CHG-004', 2, 4.50, 9.99, 150, 15, 2, '/uploads/charger.png'),
('Casual Cotton T-Shirt Unisex (Black/M)', 'CL-TSH-005', 3, 5.00, 14.99, 75, 8, 3, '/uploads/tshirt.png'),
('Non-Stick Frying Pan 10-inch', 'HL-PAN-006', 4, 11.50, 21.99, 2, 5, 3, '/uploads/pan.png');

-- Seeding default settings
INSERT IGNORE INTO settings (id, store_name, logo_url, address, phone, email, currency, tax_percentage) VALUES
(1, 'E-Mart Superstore', '/images/logo.png', '456 Retail Parkway, Shopping District, NY 10001', '+1 (555) 123-4567', 'support@emart.com', '$', 8.25);
