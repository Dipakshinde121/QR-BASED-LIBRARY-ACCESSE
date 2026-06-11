const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/books/pickup/:book_uid
 * Description: Retrieves book details by its custom pick-up UID.
 * Response: 
 *   - 200 OK: Returns book details.
 *   - 404 Not Found: If no book matches the UID.
 *   - 500 Internal Server Error: Database queries failure.
 */
router.get('/pickup/:book_uid', async (req, res) => {
    const { book_uid } = req.params;

    try {
        console.log(`[Backend] Searching database for book UID: "${book_uid}"`);

        // Query the database for the matching book record
        const [rows] = await db.query(
            'SELECT id, book_uid, title, author, slot_location, status FROM books WHERE book_uid = ?',
            [book_uid]
        );

        // Case 2: Book Not Found
        if (rows.length === 0) {
            console.log(`[Backend] Book with UID "${book_uid}" was not found.`);
            return res.status(404).json({
                message: 'Book not found'
            });
        }

        // Case 1: Book Found
        const book = rows[0];
        console.log(`[Backend] Book found: "${book.title}" located at "${book.slot_location}"`);
        return res.status(200).json({
            id: book.id,
            book_uid: book.book_uid,
            title: book.title,
            author: book.author,
            slot_location: book.slot_location,
            status: book.status
        });

    } catch (error) {
        console.error(`[Backend] Error fetching book with UID "${book_uid}":`, error.message);
        return res.status(500).json({
            message: 'Database query error',
            error: error.message
        });
    }
});

module.exports = router;
