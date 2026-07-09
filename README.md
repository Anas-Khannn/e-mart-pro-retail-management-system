# E-Mart Management System

A production-quality, database-driven E-Mart Management System built using a **Node.js/Express** backend, **MySQL** database, and a highly responsive, modern **HTML5 / CSS3 / Vanilla JS** dashboard interface. Designed for semester DBMS projects.

## Key Features

*   **Interactive Landing Page**: Sleek animated landing page containing scrolling reveal effects, float illustrations, and interactive numerical count-up statistics.
*   **Secure Authentication**: Role-based access control (Admin & Shopkeeper roles) featuring password hashing (`bcryptjs`) and secure express sessions.
*   **Forgot Password Wizard**: Multi-step password reset simulation using simulated verification codes (OTPs).
*   **POS Cashier Terminal**: Real-time sales checkouts:
    *   Search items or scan barcodes (via SKU input listener).
    *   Select customer profile for loyalty points rewards.
    *   Calculate discounts, tax additions, and cart subtotals.
    *   Dynamic invoice modal popup with print layout optimization.
    *   Automatic stock reduction on checkout via database triggers.
*   **Inventory CRUD Dashboard**: Catalog management: manage SKUs, categories, unit cost/selling prices, supplier lists, and upload product photos.
*   **CRM profiling**: Detailed customer dashboards tracking orders count, purchase history lists, total spending sum, and loyalty points.
*   **Visual Business Analytics**: Graphic reports of sales records (Daily, Weekly, Monthly, Yearly summaries), customer growth, and inventory stock alert feeds powered by `Chart.js`. Export logs to **CSV** spreadsheet or print **PDF** sheets directly.
*   **Administrative Privilege Dashboard**: CRUD user registers, edit permissions, and toggle accounts active/inactive instantly.
*   **Store Settings Configurator**: Live settings overrides: modify store name, phone numbers, currencies, default tax percentages, and uploads new invoice branding logos.
*   **Light / Dark Themes**: Full-featured theme settings saved inside the browser context, styling all views gracefully.

---

## Tech Stack

*   **Frontend**: HTML5, CSS3 Variables (Custom Styling), Vanilla Javascript, Chart.js (Data Analytics), Font Awesome 6.0 Icons.
*   **Backend**: Node.js, Express.js, Express Session.
*   **Database**: MySQL (using `mysql2/promise` wrapper).

---

## Folder Map

```
/
├── database/
│   ├── schema.sql      # Database schema, triggers, and seed data
│   └── db.js          # MySQL connection pool configuration
│   └── init.js        # Self-healing database creator & migration runner
├── css/
│   └── main.css       # Core stylesheets & theme configurations
├── js/
│   ├── api.js         # API request client wrapper & Toast notifications
│   └── navigation.js  # Navigation guard, sidebar renderer, & theme toggler
├── pages/
│   ├── login.html
│   ├── signup.html
│   ├── forgot-password.html
│   ├── pos.html
│   ├── products.html
│   ├── customers.html
│   ├── reports.html
│   ├── settings.html
│   └── users.html
├── dashboard/
│   └── index.html     # Main overview analytics screen
├── uploads/           # Uploaded product photos (auto-created on start)
├── server.js          # Express app server entry point
├── .env               # Database connection secrets
├── package.json
└── README.md
```

---

## Database Initialization & Configuration

The application features a **Self-Healing Database Initializer** that runs on startup. You do not need to manually import any SQL scripts! The system will check if the database and tables are present; if not, it automatically runs `database/schema.sql` to import the tables and default seed data.

### 1. Configure Connection Variables
Open the `.env` file in the project root and configure your MySQL server details:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=emart_db
SESSION_SECRET=emart_super_secret_session_key_2026_d645
```

### 2. Verify MySQL Service is Running
Ensure your MySQL service is started (via XAMPP, MySQL Installer, or command line).

---

## Quick Start Instructions

1.  Open your command shell inside the project folder:
    ```bash
    npm install
    ```
2.  Launch the Express server:
    ```bash
    npm start
    ```
3.  Open your browser and navigate to:
    ```
    http://localhost:3000
    ```

### Default Login Accounts (Password for both is `admin123`):

*   **System Admin**: `admin@emart.com` (Full access to all panels, including settings and staff management).
*   **Shopkeeper Staff**: `shopkeeper@emart.com` (Standard access: checkout terminal, product list, reports, customer CRM).
# e-mart-pro-retail-management-system
