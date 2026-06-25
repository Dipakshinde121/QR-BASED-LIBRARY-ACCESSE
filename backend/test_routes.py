import pytest
import json
import sqlite3
import datetime
from app import app
import db

@pytest.fixture
def client():
    """
    Setup fixture to configure test app client and reset
    the fallback SQLite database to a clean, seeded state.
    """
    app.config['TESTING'] = True
    # Reset SQLite DB to clean state
    with app.app_context():
        db_conn = db.get_db()
        if isinstance(db_conn, db.SQLiteConnectionWrapper):
            conn = db_conn.conn
            cursor = conn.cursor()
            cursor.execute("DROP TABLE IF EXISTS fines;")
            cursor.execute("DROP TABLE IF EXISTS transactions;")
            cursor.execute("DROP TABLE IF EXISTS books;")
            cursor.execute("DROP TABLE IF EXISTS users;")
            conn.commit()
            db.init_sqlite_tables(conn)
            
    with app.test_client() as test_client:
        yield test_client

def test_health_check(client):
    """
    Verifies that the /api/health endpoint is UP.
    """
    response = client.get('/api/health')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['status'] == 'UP'
    assert 'smoothly' in data['message']

def test_student_login_validation(client):
    """
    Verifies login credential checks for student accounts.
    """
    # Success Case
    response = client.post('/api/student/login', 
                           json={'roll_number': 'ST-2026-01', 'password': 'hello'})
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['user']['role'] == 'student'
    assert 'token' in data

    # Failure Case (invalid password)
    response = client.post('/api/student/login', 
                           json={'roll_number': 'ST-2026-01', 'password': 'wrongpassword'})
    assert response.status_code == 401
    assert 'Invalid credentials' in json.loads(response.data)['message']

def test_secure_qr_pickup_encryption(client):
    """
    Verifies that /api/books/pickup encrypts book codes correctly.
    """
    response = client.get('/api/books/pickup/BK-ALG-101')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['book_uid'] == 'BK-ALG-101'
    assert 'encrypted_payload' in data

def test_checkout_fine_blocking(client):
    """
    Verifies checkout is blocked if the student has unpaid fines.
    """
    # 1. Admin login to obtain token
    admin_login = client.post('/api/admin/login', 
                              json={'email': 'admin@library.com', 'password': 'hello'})
    assert admin_login.status_code == 200
    admin_token = json.loads(admin_login.data)['token']
    
    # 2. Student login to obtain token
    student_login = client.post('/api/student/login', 
                                json={'roll_number': 'ST-2026-01', 'password': 'hello'})
    assert student_login.status_code == 200
    student_data = json.loads(student_login.data)
    student_token = student_data['token']
    student_id = student_data['user']['id']
    
    # 3. Seed an unpaid overdue fine in the database
    with app.app_context():
        db_conn = db.get_db()
        with db_conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO transactions (user_id, book_id, checkout_time, due_time, status) VALUES (%s, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'returned');",
                (student_id,)
            )
            cursor.execute("SELECT id FROM transactions LIMIT 1;")
            tx_id = cursor.fetchone()
            tx_id_val = tx_id['id'] if isinstance(tx_id, dict) else tx_id[0]
            cursor.execute(
                "INSERT INTO fines (transaction_id, fine_amount, status) VALUES (%s, 20.00, 'unpaid');", (tx_id_val,)
            )
        db_conn.commit()
        
    # 4. Request the pickup QR payload
    response = client.get('/api/books/pickup/BK-ALG-101')
    assert response.status_code == 200
    qr_token = json.loads(response.data)['encrypted_payload']
    
    # 5. Try checkout - must return 403 Forbidden due to outstanding unpaid fine
    response = client.post('/api/student/checkout',
                           json={'user_id': student_id, 'book_id': qr_token},
                           headers={'Authorization': f'Bearer {student_token}'})
    assert response.status_code == 403
    assert 'outstanding unpaid library fines' in json.loads(response.data)['message']

def test_double_checkout_prevention(client):
    """
    Verifies that checking out an already borrowed book is rejected.
    """
    # Student login
    student_login = client.post('/api/student/login', 
                                json={'roll_number': 'ST-2026-01', 'password': 'hello'})
    student_data = json.loads(student_login.data)
    student_token = student_data['token']
    student_id = student_data['user']['id']
    
    # Get pickup QR
    response = client.get('/api/books/pickup/BK-ALG-101')
    qr_token = json.loads(response.data)['encrypted_payload']
    
    # First checkout succeeds
    response = client.post('/api/student/checkout',
                           json={'user_id': student_id, 'book_id': qr_token},
                           headers={'Authorization': f'Bearer {student_token}'})
    assert response.status_code == 200
    
    # Second checkout on same book must fail with 400
    response = client.post('/api/student/checkout',
                           json={'user_id': student_id, 'book_id': qr_token},
                           headers={'Authorization': f'Bearer {student_token}'})
    assert response.status_code == 400
    assert 'already checked out' in json.loads(response.data)['message']

def test_checkout_transaction_rollback_on_db_error(client):
    """
    Simulates a database failure during transaction query execution
    and verifies that modifications are correctly rolled back.
    """
    # Student login
    student_login = client.post('/api/student/login', 
                                json={'roll_number': 'ST-2026-01', 'password': 'hello'})
    student_data = json.loads(student_login.data)
    student_token = student_data['token']
    student_id = student_data['user']['id']
    
    # Get pickup QR
    response = client.get('/api/books/pickup/BK-ALG-101')
    qr_token = json.loads(response.data)['encrypted_payload']
    
    # Define custom mocked cursor execute function to trigger database operational conflict
    original_execute = db.SQLiteCursorWrapper.execute
    
    def mock_execute(self, query, params=None):
        # Intercept book status update query and raise conflict error
        if "UPDATE books SET status" in query:
            raise sqlite3.OperationalError("Simulated database write locking conflict!")
        return original_execute(self, query, params)
        
    # Patch SQLite cursor execute method
    db.SQLiteCursorWrapper.execute = mock_execute
    
    try:
        # Attempt checkout - API must fail with 500 error due to SQLite write exception
        response = client.post('/api/student/checkout',
                               json={'user_id': student_id, 'book_id': qr_token},
                               headers={'Authorization': f'Bearer {student_token}'})
        assert response.status_code == 500
        assert 'Database checkout transaction failed' in json.loads(response.data)['message']
    finally:
        # Restore original execute hook
        db.SQLiteCursorWrapper.execute = original_execute
    
    # Verify transaction rollback state:
    # 1. No transaction logs must have been written for this checkout (count = 0)
    # 2. Book status must remain 'available'
    with app.app_context():
        db_conn = db.get_db()
        with db_conn.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) as count FROM transactions WHERE book_id = 1;")
            tx_count = cursor.fetchone()
            count = tx_count['count'] if isinstance(tx_count, dict) else tx_count[0]
            assert count == 0
            
            cursor.execute("SELECT status FROM books WHERE book_uid = 'BK-ALG-101';")
            bk_status = cursor.fetchone()
            status = bk_status['status'] if isinstance(bk_status, dict) else bk_status[0]
            assert status == 'available'
