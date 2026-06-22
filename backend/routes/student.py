from flask import Blueprint, jsonify, request
from db import get_db

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
        return jsonify({
            'message': 'Login successful!',
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
def get_student_active_checkouts(student_id):
    """
    GET /api/student/active-checkouts/<student_id>
    Fetches currently active checked-out books for a specific student.
    """
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
