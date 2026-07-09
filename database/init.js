const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('../config/env');

async function initializeDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'emart_db';
  const isServerless = Boolean(process.env.VERCEL);

  const fail = (message, error) => {
    const wrappedError = new Error(`${message}: ${error.message}`);
    wrappedError.cause = error;

    if (isServerless) {
      throw wrappedError;
    }

    console.error(wrappedError.message);
    process.exit(1);
  };

  console.log(`[DB Init] Connecting to MySQL at ${host} to check/create database...`);

  // Step 1: Connect to MySQL without specifying database name first
  let tempConnection;
  try {
    tempConnection = await mysql.createConnection({
      host,
      user,
      password,
      multipleStatements: true
    });
  } catch (error) {
    fail('[DB Init] Failed to connect to MySQL server. Please ensure MySQL is running', error);
  }

  try {
    // Step 2: Create database if not exists
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
    console.log(`[DB Init] Checked/Created database "${database}".`);
  } catch (error) {
    await tempConnection.end();
    tempConnection = null;
    fail('[DB Init] Error creating database', error);
  } finally {
    if (tempConnection) await tempConnection.end();
  }

  // Step 3: Connect to the specific database
  console.log(`[DB Init] Connecting directly to database "${database}"...`);
  const connection = await mysql.createConnection({
    host,
    user,
    password,
    database,
    multipleStatements: true
  });

  try {
    console.log(`[DB Init] Applying idempotent schema migration from schema.sql...`);
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    await connection.query(schemaSql);
    console.log(`[DB Init] Database schema migration completed.`);

    const [columns] = await connection.query(`
      SELECT COLUMN_NAME
      FROM information_schema.columns
      WHERE table_schema = ? AND table_name = 'users' AND column_name = 'profile_image_url'
    `, [database]);

    if (columns.length === 0) {
      await connection.query(`ALTER TABLE users ADD COLUMN profile_image_url VARCHAR(255) NULL AFTER password_hash`);
      console.log(`[DB Init] Added users.profile_image_url column.`);
    }
  } catch (error) {
    fail('[DB Init] Error initializing database schema', error);
  } finally {
    await connection.end();
  }
}

module.exports = initializeDatabase;
