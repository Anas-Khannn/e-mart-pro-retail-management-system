const mysql = require('mysql2/promise');
require('../config/env');
const getDatabaseConfig = require('./config');

// Create connection pool config
const poolConfig = {
  ...getDatabaseConfig(),
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10000,
  acquireTimeout: 10000
};

// Create the pool
const pool = mysql.createPool(poolConfig);

console.log(`[Database] Connection pool created for ${poolConfig.user}@${poolConfig.host}:${poolConfig.port}/${poolConfig.database}`);

module.exports = pool;
