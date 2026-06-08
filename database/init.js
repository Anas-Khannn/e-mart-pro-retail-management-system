const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initializeDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'emart_db';

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
    console.error(`[DB Init] Failed to connect to MySQL server. Please ensure MySQL is running. Error: ${error.message}`);
    process.exit(1);
  }

  try {
    // Step 2: Create database if not exists
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
    console.log(`[DB Init] Checked/Created database "${database}".`);
  } catch (error) {
    console.error(`[DB Init] Error creating database: ${error.message}`);
    await tempConnection.end();
    process.exit(1);
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
    // Step 4: Check if tables exist by querying for the 'users' table
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.tables 
      WHERE table_schema = ? AND table_name = 'users'
    `, [database]);

    if (tables.length === 0) {
      console.log(`[DB Init] Tables not found. Initializing schema from schema.sql...`);
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');

      // Execute schema.sql
      await connection.query(schemaSql);
      console.log(`[DB Init] Database schema imported successfully with seed data.`);
    } else {
      console.log(`[DB Init] Database tables already exist. Skipping schema initialization.`);
    }
  } catch (error) {
    console.error(`[DB Init] Error initializing database schema: ${error.message}`);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

module.exports = initializeDatabase;
