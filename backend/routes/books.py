from flask import Blueprint, jsonify
from db import get_db

books_bp = Blueprint('books', __name__)

@books_bp.route('/pickup/<book_uid>', methods=['GET'])
def get_book_by_uid(book_uid):
    """
    GET /api/books/pickup/<book_uid>
    Retrieves book details by its custom pick-up UID.
    """
    try:
        print(f'[Backend] Searching database for book UID: "{book_uid}"')
        db = get_db()
        with db.cursor() as cursor:
            sql = 'SELECT id, book_uid, title, author, slot_location, status FROM books WHERE book_uid = %s'
            cursor.execute(sql, (book_uid,))
            row = cursor.fetchone()

        if not row:
            print(f'[Backend] Book with UID "{book_uid}" was not found.')
            return jsonify({'message': 'Book not found'}), 404

        print(f'[Backend] Book found: "{row["title"]}" located at "{row["slot_location"]}"')
        return jsonify({
            'id': row['id'],
            'book_uid': row['book_uid'],
            'title': row['title'],
            'author': row['author'],
            'slot_location': row['slot_location'],
            'status': row['status']
        }), 200

    except Exception as error:
        print(f'[Backend] Error fetching book with UID "{book_uid}":', str(error))
        return jsonify({
            'message': 'Database query error',
            'error': str(error)
        }), 500
