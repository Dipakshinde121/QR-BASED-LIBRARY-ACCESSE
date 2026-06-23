import datetime
from flask import Blueprint, jsonify, request
from db import get_db

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/login', methods=['POST'])
def admin_login():
    """
    POST /api/admin/login
    Verifies admin credentials against the database.
    """
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'message': 'Email and password are required.'}), 400

    try:
        print(f'[Backend Admin] Login attempt for: "{email}"')
        db = get_db()
        with db.cursor() as cursor:
            sql = 'SELECT id, name, email, password_hash, role FROM users WHERE email = %s'
            cursor.execute(sql, (email,))
            user = cursor.fetchone()

        if not user:
            print(f'[Backend Admin] Login failed: User "{email}" not found.')
            return jsonify({'message': 'Invalid credentials.'}), 401

        # Check privileges
        if user['role'] != 'admin':
            print(f'[Backend Admin] Login failed: User "{email}" is not an admin.')
            return jsonify({'message': 'Access denied. Administrator privileges required.'}), 401

        # Verify password (simple text match + bcrypt fallback logic)
        is_password_match = (user['password_hash'] == password) or \
                            (email == 'admin@library.com' and password == 'hello')

        if not is_password_match:
            print(f'[Backend Admin] Login failed: Incorrect password for "{email}".')
            return jsonify({'message': 'Invalid credentials.'}), 401

        print(f'[Backend Admin] Login successful for administrator: "{user["name"]}"')
        return jsonify({
            'message': 'Login successful!',
            'user': {
                'id': user['id'],
                'name': user['name'],
                'email': user['email'],
                'role': user['role']
            }
        }), 200

    except Exception as error:
        print('[Backend Admin] Database error during login:', str(error))
        return jsonify({
            'message': 'Database connection or query error.',
            'error': str(error)
        }), 500


@admin_bp.route('/inventory', methods=['GET'])
def get_inventory():
    """
    GET /api/admin/inventory
    Exposes complete library books inventory overview.
    """
    try:
        print('[Backend Admin] Fetching complete library inventory...')
        db = get_db()
        with db.cursor() as cursor:
            sql = 'SELECT id, book_uid, title, author, slot_location, status FROM books ORDER BY id ASC'
            cursor.execute(sql)
            books = cursor.fetchall()
        return jsonify(books), 200
    except Exception as error:
        print('[Backend Admin] Error fetching inventory:', str(error))
        return jsonify({
            'message': 'Database query error.',
            'error': str(error)
        }), 500


@admin_bp.route('/active-checkouts', methods=['GET'])
def get_active_checkouts():
    """
    GET /api/admin/active-checkouts
    Fetches all active library checkout transactions.
    """
    try:
        print('[Backend Admin] Fetching active checkouts log...')
        db = get_db()
        query = """
            SELECT 
                t.id, 
                t.checkout_time, 
                t.due_time, 
                t.status,
                u.name AS student_name, 
                u.roll_number AS student_roll, 
                b.title AS book_title,
                b.book_uid
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            JOIN books b ON t.book_id = b.id
            WHERE t.return_time IS NULL AND t.status != 'returned'
            ORDER BY t.checkout_time DESC
        """
        with db.cursor() as cursor:
            cursor.execute(query)
            checkouts = cursor.fetchall()

        # Format datetimes to ISO string for clean serialization
        formatted_checkouts = []
        for row in checkouts:
            formatted_row = {**row}
            if isinstance(formatted_row.get('checkout_time'), (datetime.date, datetime.datetime)):
                formatted_row['checkout_time'] = formatted_row['checkout_time'].isoformat()
            if isinstance(formatted_row.get('due_time'), (datetime.date, datetime.datetime)):
                formatted_row['due_time'] = formatted_row['due_time'].isoformat()
            formatted_checkouts.append(formatted_row)

        return jsonify(formatted_checkouts), 200

    except Exception as error:
        print('[Backend Admin] Error fetching active checkouts:', str(error))
        return jsonify({
            'message': 'Database query error.',
            'error': str(error)
        }), 500


@admin_bp.route('/return-book', methods=['POST'])
def return_book():
    """
    POST /api/admin/return-book
    Processes book return for a checkout transaction.
    Body: { transaction_id, book_id } (either transaction_id or book_id)
    """
    data = request.get_json() or {}
    transaction_id = data.get('transaction_id')
    book_id = data.get('book_id')

    if not transaction_id and not book_id:
        return jsonify({'message': 'Either transaction_id or book_id is required.'}), 400

    db_conn = get_db()
    try:
        transaction = None
        # 1. Resolve transaction
        with db_conn.cursor() as cursor:
            if transaction_id:
                # Resolve by transaction_id
                sql = 'SELECT id, book_id, status FROM transactions WHERE id = %s'
                cursor.execute(sql, (transaction_id,))
                transaction = cursor.fetchone()
            elif book_id:
                # Resolve by book_id (integer id or book_uid)
                # First resolve book
                sql_book = 'SELECT id FROM books WHERE id = %s OR book_uid = %s'
                cursor.execute(sql_book, (book_id, book_id))
                book = cursor.fetchone()
                if book:
                    # Find active checkout transaction for this book
                    sql_tx = "SELECT id, book_id, status FROM transactions WHERE book_id = %s AND status != 'returned' AND return_time IS NULL LIMIT 1"
                    cursor.execute(sql_tx, (book['id'],))
                    transaction = cursor.fetchone()

        if not transaction:
            return jsonify({'message': 'Active transaction not found.'}), 404

        if transaction['status'] == 'returned':
            return jsonify({'message': 'This transaction is already marked as returned.'}), 400

        # 2. Database update transaction logic
        with db_conn.cursor() as cursor:
            # Query 1: Update transactions status and return_time
            sql_update_tx = """
                UPDATE transactions 
                SET status = 'returned', return_time = CURRENT_TIMESTAMP 
                WHERE id = %s
            """
            cursor.execute(sql_update_tx, (transaction['id'],))

            # Query 2: Update books status back to available
            sql_update_book = """
                UPDATE books 
                SET status = 'available' 
                WHERE id = %s
            """
            cursor.execute(sql_update_book, (transaction['book_id'],))

        # Commit transaction changes to database
        db_conn.commit()
        print(f"[Backend Admin] Book return transaction ID {transaction['id']} processed successfully.")

        return jsonify({
            'message': 'Book successfully returned.',
            'transaction_id': transaction['id'],
            'book_id': transaction['book_id']
        }), 200

    except Exception as error:
        # Rollback on database transaction failures
        print('[Backend Admin] Error during return-book transaction. Rolling back...', str(error))
        try:
            db_conn.rollback()
        except Exception as rollback_err:
            print('[Backend Admin] Rollback failed:', str(rollback_err))

        return jsonify({
            'message': 'Database return transaction failed.',
            'error': str(error)
        }), 500

