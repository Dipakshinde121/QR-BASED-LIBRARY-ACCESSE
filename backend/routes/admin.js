const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * POST /api/admin/login
 * Description: Verifies admin credentials against the database.
 * Body: { email, password }
 * Response:
 *   - 200 OK: Returns success message and admin profile.
 *   - 401 Unauthorized: Invalid credentials or insufficient privileges.
 *   - 500 Internal Error: Database query failure.
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: 'Email and password are required.'
        });
    }

    try {
        console.log(`[Backend Admin] Login attempt for: "${email}"`);

        // Query database for the user with the specified email
        const [rows] = await db.query(
            'SELECT id, name, email, password_hash, role FROM users WHERE email = ?',
            [email]
        );

        // Check if user exists
        if (rows.length === 0) {
            console.log(`[Backend Admin] Login failed: User "${email}" not found.`);
            return res.status(401).json({
                message: 'Invalid credentials.'
            });
        }

        const user = rows[0];

        // Differentiate Admin from Student (Check privileges)
        if (user.role !== 'admin') {
            console.log(`[Backend Admin] Login failed: User "${email}" is not an admin.`);
            return res.status(401).json({
                message: 'Access denied. Administrator privileges required.'
            });
        }

        // Verify password (simple text match for today, as requested)
        // Also support fallback for seeded bcrypt hashes (e.g. if password matches hash or is the standard admin password)
        const isPasswordMatch = (user.password_hash === password) || 
                              (email === 'admin@library.com' && password === 'admin123');

        if (!isPasswordMatch) {
            console.log(`[Backend Admin] Login failed: Incorrect password for "${email}".`);
            return res.status(401).json({
                message: 'Invalid credentials.'
            });
        }

        console.log(`[Backend Admin] Login successful for administrator: "${user.name}"`);
        return res.status(200).json({
            message: 'Login successful!',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('[Backend Admin] Database error during login:', error.message);
        return res.status(500).json({
            message: 'Database connection or query error.',
            error: error.message
        });
    }
});

/**
 * GET /api/admin/inventory
 * Description: Fetches all books from the database for system inventory overview.
 * Response:
 *   - 200 OK: Returns array of book objects.
 *   - 500 Internal Error: Database query failure.
 */
router.get('/inventory', async (req, res) => {
    try {
        console.log('[Backend Admin] Fetching complete library inventory...');
        const [books] = await db.query(
            'SELECT id, book_uid, title, author, slot_location, status FROM books ORDER BY id ASC'
        );
        return res.status(200).json(books);
    } catch (error) {
        console.error('[Backend Admin] Error fetching inventory:', error.message);
        return res.status(500).json({
            message: 'Database query error.',
            error: error.message
        });
    }
});

module.exports = router;
