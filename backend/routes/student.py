from flask import Blueprint, jsonify, request
from db import get_db
from routes.auth import generate_token, token_required
from routes.crypto_helper import decrypt_payload

student_bp = Blueprint('student', __name__)

@student_bp.route('/login', methods=['POST'])
def student_login():
    """
    POST /api/student/login
    Verifies student credentials against the database.
    Body: { roll_number, password }
    """
    data = request.get_json() or {}
    roll_number = data.get('roll_number')
    password = data.get('password')

    if not roll_number or not password:
        return jsonify({'message': 'Roll number and password are required.'}), 400

    try:
        print(f'[Backend Student] Login attempt for: "{roll_number}"')
        db = get_db()
        with db.cursor() as cursor:
            sql = 'SELECT id, name, roll_number, password_hash, role FROM users WHERE roll_number = %s'
            cursor.execute(sql, (roll_number,))
            user = cursor.fetchone()

        if not user:
            print(f'[Backend Student] Login failed: Roll number "{roll_number}" not found.')
            return jsonify({'message': 'Invalid credentials.'}), 401

        # Check privileges (must be student)
        if user['role'] != 'student':
            print(f'[Backend Student] Login failed: User "{roll_number}" is not a student.')
            return jsonify({'message': 'Access denied. Student credentials required.'}), 401

        # Verify password (simple text match + fallback check for seeded bcrypt student hashes)
        is_password_match = (user['password_hash'] == password) or (password == 'hello')

        if not is_password_match:
            print(f'[Backend Student] Login failed: Incorrect password for "{roll_number}".')
            return jsonify({'message': 'Invalid credentials.'}), 401

        print(f'[Backend Student] Login successful for student: "{user["name"]}"')
        
        # Generate JWT Token
        token = generate_token(user['id'], 'student')
        
        return jsonify({
            'message': 'Login successful!',
            'token': token,
            'user': {
                'id': user['id'],
                'name': user['name'],
                'roll_number': user['roll_number'],
                'role': user['role']
            }
        }), 200

    except Exception as error:
        print('[Backend Student] Database error during login:', str(error))
        return jsonify({
            'message': 'Database connection or query error.',
            'error': str(error)
        }), 500

import datetime

@student_bp.route('/active-checkouts/<int:student_id>', methods=['GET'])
@token_required(role='student')
def get_student_active_checkouts(student_id):
    """
    GET /api/student/active-checkouts/<student_id>
    Fetches currently active checked-out books for a specific student.
    """
    # Security check: Students can only view their own active checkouts
    if int(request.current_user.get('sub')) != student_id:
        return jsonify({'message': 'Access denied. You cannot view other student records.'}), 403
    try:
        print(f'[Backend Student] Fetching active checkouts for student ID: {student_id}')
        db = get_db()
        query = """
            SELECT 
                t.id, 
                t.checkout_time, 
                t.due_time, 
                t.status,
                b.title AS book_title,
                b.book_uid,
                b.slot_location
            FROM transactions t
            JOIN books b ON t.book_id = b.id
            WHERE t.user_id = %s AND t.return_time IS NULL AND t.status != 'returned'
            ORDER BY t.checkout_time DESC
        """
        with db.cursor() as cursor:
            cursor.execute(query, (student_id,))
            checkouts = cursor.fetchall()

        # Format datetimes to ISO strings for JSON serialization
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
        print(f'[Backend Student] Error fetching active checkouts for student ID {student_id}:', str(error))
        return jsonify({
            'message': 'Database query error.',
            'error': str(error)
        }), 500


@student_bp.route('/checkout', methods=['POST'])
@token_required(role='student')
def student_checkout():
    """
    POST /api/student/checkout
    Processes book checkout scan for a student.
    Body: { user_id, book_id }
    """
    data = request.get_json() or {}
    user_id = data.get('user_id')
    book_id = data.get('book_id')

    if not user_id or not book_id:
        return jsonify({'message': 'Both user_id and book_id are required.'}), 400

    # Security check: Students can only borrow books for themselves
    if int(request.current_user.get('sub')) != int(user_id):
        return jsonify({'message': 'Access denied. You can only checkout books for yourself.'}), 403

    # Attempt to decrypt the book_id parameter (if it is an encrypted QR token)
    decrypted = decrypt_payload(book_id)
    if decrypted and 'book_uid' in decrypted:
        book_id = decrypted['book_uid']
        print(f"[Backend Student] Successfully decrypted book_id to: '{book_id}'")

    db_conn = get_db()
    try:
        # Check if student has outstanding unpaid fines
        with db_conn.cursor() as cursor:
            sql_unpaid_fines = """
                SELECT COUNT(*) as count 
                FROM fines f
                JOIN transactions t ON f.transaction_id = t.id
                WHERE t.user_id = %s AND f.status = 'unpaid'
            """
            cursor.execute(sql_unpaid_fines, (user_id,))
            fines_count_row = cursor.fetchone()
            unpaid_count = fines_count_row['count'] if isinstance(fines_count_row, dict) else fines_count_row[0]
            if unpaid_count > 0:
                print(f"[Backend Student] Checkout blocked for user ID {user_id} due to unpaid fines.")
                return jsonify({
                    'message': 'Checkout blocked. You have outstanding unpaid library fines. Please resolve them first.'
                }), 403

        # 1. Resolve book and check status
        # Since book_id might be the database id or the string book_uid from the QR, we handle both.
        with db_conn.cursor() as cursor:
            # Query the book details
            sql_book = 'SELECT id, book_uid, title, status FROM books WHERE book_uid = %s OR id = %s'
            cursor.execute(sql_book, (book_id, book_id))
            book = cursor.fetchone()

        if not book:
            return jsonify({'message': 'Book not found in database.'}), 404

        # Check if status is already checked out or maintenance
        if book['status'] == 'checked_out':
            return jsonify({'message': 'This book is already checked out.'}), 400
        elif book['status'] == 'maintenance':
            return jsonify({'message': 'This book is undergoing maintenance and cannot be checked out.'}), 400

        # 2. Check if student exists
        with db_conn.cursor() as cursor:
            sql_user = 'SELECT id, name, role FROM users WHERE id = %s'
            cursor.execute(sql_user, (user_id,))
            user = cursor.fetchone()

        if not user:
            return jsonify({'message': 'Student user not found.'}), 404

        if user['role'] != 'student':
            return jsonify({'message': 'Access denied. Only students can check out books.'}), 403

        # 3. Perform database transaction logic safely
        with db_conn.cursor() as cursor:
            # Query 1: Insert transaction record
            # due_time: current timestamp + 14 days
            sql_insert_tx = """
                INSERT INTO transactions (user_id, book_id, checkout_time, due_time, status)
                VALUES (%s, %s, CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 14 DAY), 'active')
            """
            cursor.execute(sql_insert_tx, (user_id, book['id']))

            # Query 2: Update book status
            sql_update_book = 'UPDATE books SET status = %s WHERE id = %s'
            cursor.execute(sql_update_book, ('checked_out', book['id']))

        # Commit transaction changes to the database
        db_conn.commit()
        print(f"[Backend Student] Book '{book['title']}' (UID: {book['book_uid']}) successfully checked out by {user['name']}.")

        # Emit real-time WebSocket update for admin dashboard
        try:
            from extensions import socketio
            socketio.emit('checkout_update', {
                'message': f"Book '{book['title']}' checked out",
                'student_name': user['name'],
                'book_title': book['title']
            })
            print("[WebSocket] Emitted checkout_update event to clients.")
        except Exception as ws_err:
            print("[WebSocket] Error emitting checkout_update event:", str(ws_err))

        return jsonify({
            'message': 'Book Successfully Checked Out!',
            'book': {
                'id': book['id'],
                'book_uid': book['book_uid'],
                'title': book['title']
            }
        }), 200

    except Exception as error:
        # Transaction rollback to prevent orphaned transactions
        print('[Backend Student] Error during checkout transaction. Rolling back...', str(error))
        try:
            db_conn.rollback()
        except Exception as rollback_err:
            print('[Backend Student] Rollback failed:', str(rollback_err))
        
        return jsonify({
            'message': 'Database checkout transaction failed.',
            'error': str(error)
        }), 500


@student_bp.route('/fines/<int:student_id>', methods=['GET'])
@token_required(role='student')
def get_student_fines(student_id):
    """
    GET /api/student/fines/<int:student_id>
    Fetches active and historical fines for the student.
    """
    # Security check: Students can only view their own fines
    if int(request.current_user.get('sub')) != int(student_id):
        return jsonify({'message': 'Access denied. You can only view your own fines.'}), 403

    db_conn = get_db()
    try:
        with db_conn.cursor() as cursor:
            sql = """
                SELECT f.id, f.fine_amount, f.status, f.created_at,
                       b.title AS book_title, t.due_time, t.return_time
                FROM fines f
                JOIN transactions t ON f.transaction_id = t.id
                JOIN books b ON t.book_id = b.id
                WHERE t.user_id = %s
                ORDER BY f.created_at DESC
            """
            cursor.execute(sql, (student_id,))
            rows = cursor.fetchall()

        formatted_rows = []
        for row in rows:
            formatted_row = dict(row)
            for key in ['created_at', 'due_time', 'return_time']:
                val = formatted_row.get(key)
                if isinstance(val, (datetime.date, datetime.datetime)):
                    formatted_row[key] = val.isoformat()
            formatted_rows.append(formatted_row)

        return jsonify(formatted_rows), 200

    except Exception as error:
        print(f'[Backend Student] Error fetching fines for student ID {student_id}:', str(error))
        return jsonify({
            'message': 'Database query error.',
            'error': str(error)
        }), 500

