const mysql = require('mysql2/promise');
require('../config/env');

// Create connection pool config
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'emart_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true // Essential for running migrations and triggers
};

// Create the pool
const pool = mysql.createPool(poolConfig);

console.log(`[Database] Connection pool created for ${poolConfig.user}@${poolConfig.host}:${poolConfig.database}`);

module.exports = pool;
