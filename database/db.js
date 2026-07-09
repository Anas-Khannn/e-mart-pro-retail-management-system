const mysql = require('mysql2/promise');
require('../config/env');
const getDatabaseConfig = require('./config');

// Create connection pool config
const poolConfig = {
  ...getDatabaseConfig(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true // Essential for running migrations and triggers
};

// Create the pool
const pool = mysql.createPool(poolConfig);

console.log(`[Database] Connection pool created for ${poolConfig.user}@${poolConfig.host}:${poolConfig.port}/${poolConfig.database}`);

module.exports = pool;
