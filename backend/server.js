const express = require('express');
require('dotenv').config();

// Import the database connection to initialize it
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware to parse JSON bodies
app.use(express.json());

// Mount API routes
const booksRouter = require('./routes/books');
app.use('/api/books', booksRouter);

// Basic health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'UP',
        message: 'Library Kiosk API is running smoothly.',
        timestamp: new Date()
    });
});

// Root route
app.get('/', (req, res) => {
    res.send('Library Kiosk Backend Server is Active.');
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
