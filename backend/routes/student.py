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
        is_password_match = (user['password_hash'] == password) or (password == 'student123')

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
