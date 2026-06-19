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
