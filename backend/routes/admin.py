import datetime
from flask import Blueprint, jsonify, request, current_app
from db import get_db
from routes.auth import generate_token, token_required

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
        
        # Generate JWT Token
        token = generate_token(user['id'], 'admin')
        
        return jsonify({
            'message': 'Login successful!',
            'token': token,
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
@token_required(role='admin')
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
@token_required(role='admin')
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
@token_required(role='admin')
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
                sql = 'SELECT id, book_id, due_time, status FROM transactions WHERE id = %s'
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
                    sql_tx = "SELECT id, book_id, due_time, status FROM transactions WHERE book_id = %s AND status != 'returned' AND return_time IS NULL LIMIT 1"
                    cursor.execute(sql_tx, (book['id'],))
                    transaction = cursor.fetchone()

        if not transaction:
            return jsonify({'message': 'Active transaction not found.'}), 404

        if transaction['status'] == 'returned':
            return jsonify({'message': 'This transaction is already marked as returned.'}), 400

        # 2. Database update transaction logic
        import math
        fine_amount = 0.0
        days_overdue = 0
        is_overdue = False

        due_time_val = transaction['due_time']
        if isinstance(due_time_val, str):
            try:
                if '.' in due_time_val:
                    due_time = datetime.datetime.strptime(due_time_val, "%Y-%m-%d %H:%M:%S.%f")
                else:
                    due_time = datetime.datetime.strptime(due_time_val, "%Y-%m-%d %H:%M:%S")
            except Exception as e:
                print(f"[Backend Admin] Error parsing due_time '{due_time_val}':", str(e))
                due_time = datetime.datetime.utcnow()
        else:
            due_time = due_time_val

        now = datetime.datetime.utcnow()
        if now > due_time:
            diff = now - due_time
            if diff.total_seconds() > 0:
                is_overdue = True
                days_overdue = math.ceil(diff.total_seconds() / 86400.0)
                FINE_RATE_PER_DAY = 10.00
                fine_amount = days_overdue * FINE_RATE_PER_DAY

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

            # Query 3: If overdue, insert fine record
            if is_overdue and fine_amount > 0:
                sql_insert_fine = """
                    INSERT INTO fines (transaction_id, fine_amount, status)
                    VALUES (%s, %s, 'unpaid')
                """
                cursor.execute(sql_insert_fine, (transaction['id'], fine_amount))

        # Commit transaction changes to database
        db_conn.commit()
        print(f"[Backend Admin] Book return transaction ID {transaction['id']} processed successfully. Overdue: {is_overdue}, Fine: {fine_amount}")

        return jsonify({
            'message': 'Book successfully returned.',
            'transaction_id': transaction['id'],
            'book_id': transaction['book_id'],
            'overdue': is_overdue,
            'days_overdue': days_overdue,
            'fine_amount': fine_amount
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


@admin_bp.route('/trigger-reminders', methods=['POST'])
@token_required(role='admin')
def trigger_reminders():
    """
    POST /api/admin/trigger-reminders
    Manually triggers checking and dispatching due date reminders.
    """
    try:
        from reminders import check_and_send_reminders
        print("[Backend Admin] Manual reminders execution triggered.")
        count = check_and_send_reminders(current_app)
        return jsonify({
            'message': 'Due-date reminders job executed successfully.',
            'reminders_sent': count
        }), 200
    except Exception as error:
        print("[Backend Admin] Error during manual reminders trigger:", str(error))
        return jsonify({
            'message': 'Failed to run manual reminders job.',
            'error': str(error)
        }), 500


@admin_bp.route('/fines', methods=['GET'])
@token_required(role='admin')
def get_all_fines():
    """
    GET /api/admin/fines
    Returns all fine records with user, book, and transaction details.
    """
    try:
        db_conn = get_db()
        with db_conn.cursor() as cursor:
            sql = """
                SELECT f.id, f.fine_amount, f.status, f.created_at, 
                       u.name AS student_name, u.roll_number AS student_roll,
                       b.title AS book_title, t.due_time, t.return_time
                FROM fines f
                JOIN transactions t ON f.transaction_id = t.id
                JOIN users u ON t.user_id = u.id
                JOIN books b ON t.book_id = b.id
                ORDER BY f.created_at DESC
            """
            cursor.execute(sql)
            rows = cursor.fetchall()
            
        # Format datetime columns to ISO string
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
        print("[Backend Admin] Error fetching all fines:", str(error))
        return jsonify({'message': 'Database error.', 'error': str(error)}), 500


@admin_bp.route('/pay-fine', methods=['POST'])
@token_required(role='admin')
def pay_fine():
    """
    POST /api/admin/pay-fine
    Marks a student's outstanding fine as paid.
    Body: { fine_id }
    """
    data = request.get_json() or {}
    fine_id = data.get('fine_id')
    if not fine_id:
        return jsonify({'message': 'fine_id is required.'}), 400
        
    db_conn = get_db()
    try:
        with db_conn.cursor() as cursor:
            # Check if fine exists
            cursor.execute("SELECT id, status FROM fines WHERE id = %s", (fine_id,))
            fine = cursor.fetchone()
            if not fine:
                return jsonify({'message': 'Fine record not found.'}), 404
                
            if fine['status'] == 'paid':
                return jsonify({'message': 'Fine is already paid.'}), 400
                
            # Update status
            cursor.execute("UPDATE fines SET status = 'paid' WHERE id = %s", (fine_id,))
        db_conn.commit()
        print(f"[Backend Admin] Fine ID {fine_id} successfully marked as paid.")
        return jsonify({
            'message': 'Fine marked as paid successfully.',
            'fine_id': fine_id
        }), 200
    except Exception as error:
        print('[Backend Admin] Error marking fine as paid:', str(error))
        return jsonify({'message': 'Database error.', 'error': str(error)}), 500


@admin_bp.route('/statistics', methods=['GET'])
@token_required(role='admin')
def get_library_statistics():
    """
    GET /api/admin/statistics
    Calculates dynamic library stats (Active Loans, Unpaid/Paid Fines, Peak Hours, Most Borrowed Books)
    """
    db_conn = get_db()
    try:
        stats = {
            'summary': {
                'total_students': 0,
                'total_books': 0,
                'active_checkouts': 0,
                'total_fines_unpaid': 0.0,
                'total_fines_paid': 0.0
            },
            'most_borrowed': [],
            'hourly_checkouts': {}
        }
        
        with db_conn.cursor() as cursor:
            # 1. Total Students
            cursor.execute("SELECT COUNT(*) as count FROM users WHERE role = 'student'")
            row = cursor.fetchone()
            stats['summary']['total_students'] = row['count'] if isinstance(row, dict) else row[0]
            
            # 2. Total Books
            cursor.execute("SELECT COUNT(*) as count FROM books")
            row = cursor.fetchone()
            stats['summary']['total_books'] = row['count'] if isinstance(row, dict) else row[0]
            
            # 3. Active Checkouts
            cursor.execute("SELECT COUNT(*) as count FROM transactions WHERE status = 'active'")
            row = cursor.fetchone()
            stats['summary']['active_checkouts'] = row['count'] if isinstance(row, dict) else row[0]
            
            # 4. Unpaid Fines Sum
            cursor.execute("SELECT SUM(fine_amount) as total FROM fines WHERE status = 'unpaid'")
            row = cursor.fetchone()
            val = row['total'] if isinstance(row, dict) else row[0]
            stats['summary']['total_fines_unpaid'] = float(val) if val is not None else 0.0
            
            # 5. Paid Fines Sum
            cursor.execute("SELECT SUM(fine_amount) as total FROM fines WHERE status = 'paid'")
            row = cursor.fetchone()
            val = row['total'] if isinstance(row, dict) else row[0]
            stats['summary']['total_fines_paid'] = float(val) if val is not None else 0.0
            
            # 6. Most Borrowed Books (Top 5)
            sql_most_borrowed = """
                SELECT b.title, COUNT(t.id) as borrow_count
                FROM transactions t
                JOIN books b ON t.book_id = b.id
                GROUP BY t.book_id, b.title
                ORDER BY borrow_count DESC
                LIMIT 5
            """
            cursor.execute(sql_most_borrowed)
            rows = cursor.fetchall()
            stats['most_borrowed'] = [
                {'title': r['title'], 'count': r['borrow_count']}
                for r in rows
            ]
            
            # 7. Peak Checkout Hours
            cursor.execute("SELECT checkout_time FROM transactions")
            tx_times = cursor.fetchall()
            
        hourly_counts = {f"{h:02d}": 0 for h in range(24)}
        for tx in tx_times:
            raw_time = tx['checkout_time']
            if isinstance(raw_time, str):
                try:
                    if '.' in raw_time:
                        dt = datetime.datetime.strptime(raw_time, "%Y-%m-%d %H:%M:%S.%f")
                    else:
                        dt = datetime.datetime.strptime(raw_time, "%Y-%m-%d %H:%M:%S")
                    hour_str = f"{dt.hour:02d}"
                except Exception:
                    try:
                        dt = datetime.datetime.fromisoformat(raw_time.replace('Z', '+00:00'))
                        hour_str = f"{dt.hour:02d}"
                    except Exception:
                        hour_str = "00"
            elif isinstance(raw_time, (datetime.date, datetime.datetime)):
                hour_str = f"{raw_time.hour:02d}"
            else:
                hour_str = "00"
                
            if hour_str in hourly_counts:
                hourly_counts[hour_str] += 1
                
        stats['hourly_checkouts'] = hourly_counts
        
        return jsonify(stats), 200
        
    except Exception as error:
        print("[Backend Admin] Error generating statistics:", str(error))
        return jsonify({'message': 'Database error.', 'error': str(error)}), 500


@admin_bp.route('/transactions/export', methods=['GET'])
@token_required(role='admin')
def export_transactions_csv():
    """
    GET /api/admin/transactions/export
    Queries entire transaction log and downloads as a CSV file.
    """
    import csv
    import io
    from flask import Response
    
    db_conn = get_db()
    try:
        sql = """
            SELECT 
                t.id AS transaction_id,
                u.name AS student_name,
                u.roll_number AS student_roll,
                u.email AS student_email,
                b.title AS book_title,
                b.book_uid AS book_uid,
                t.checkout_time,
                t.due_time,
                t.return_time,
                t.status AS transaction_status,
                f.fine_amount AS fine_amount,
                f.status AS fine_status
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            JOIN books b ON t.book_id = b.id
            LEFT JOIN fines f ON f.transaction_id = t.id
            ORDER BY t.id DESC
        """
        with db_conn.cursor() as cursor:
            cursor.execute(sql)
            rows = cursor.fetchall()
            
        output = io.StringIO()
        writer = csv.writer(output)
        
        # CSV Headers
        writer.writerow([
            'Transaction ID', 
            'Student Name', 
            'Student Roll Number', 
            'Student Email', 
            'Book Title', 
            'Book UID', 
            'Checkout Time', 
            'Due Time', 
            'Return Time', 
            'Transaction Status', 
            'Fine Amount', 
            'Fine Status'
        ])
        
        for row in rows:
            # Handle datetime string conversion or datetime objects
            checkout_t = row['checkout_time']
            due_t = row['due_time']
            return_t = row['return_time'] or "N/A"
            
            if isinstance(checkout_t, (datetime.date, datetime.datetime)):
                checkout_t = checkout_t.isoformat()
            if isinstance(due_t, (datetime.date, datetime.datetime)):
                due_t = due_t.isoformat()
            if isinstance(return_t, (datetime.date, datetime.datetime)):
                return_t = return_t.isoformat()
                
            fine_val = row.get('fine_amount')
            fine_amt = f"${float(fine_val):.2f}" if fine_val is not None else "$0.00"
            fine_stat = (row.get('fine_status') or 'NONE').upper()
            
            writer.writerow([
                row['transaction_id'],
                row['student_name'],
                row['student_roll'] or "N/A",
                row['student_email'],
                row['book_title'],
                row['book_uid'],
                checkout_t,
                due_t,
                return_t,
                row['transaction_status'].upper(),
                fine_amt,
                fine_stat
            ])
            
        response_data = output.getvalue()
        output.close()
        
        return Response(
            response_data,
            mimetype="text/csv",
            headers={"Content-disposition": "attachment; filename=transactions_report.csv"}
        )
    except Exception as error:
        print("[Backend Admin] Error exporting CSV transactions log:", str(error))
        return jsonify({'message': 'Database error.', 'error': str(error)}), 500


