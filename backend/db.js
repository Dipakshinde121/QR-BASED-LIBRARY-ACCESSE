const mysql = require('mysql2');
require('dotenv').config();

// Create a connection pool to manage database connections efficiently
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    database: process.env.DB_NAME || 'library_access_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Get a promise-wrapped pool for clean async/await queries
const db = pool.promise();

// Attempt to get a connection from the pool to verify settings
pool.getConnection((err, connection) => {
    if (err) {
        console.error('====================================================');
        console.error('❌ Database connection failed!');
        console.error('Error Details:', err.message);
        console.error('Please verify your MySQL server is running (e.g. via XAMPP).');
        console.error('====================================================');
    } else {
        console.log('====================================================');
        console.log('✅ Connected to the database successfully!');
        console.log('====================================================');
        connection.release(); // Return connection back to the pool
    }
});

module.exports = db;
