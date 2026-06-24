import unittest
import json
import sqlite3
import os
from app import app
import db

class TestLibraryWorkflow(unittest.TestCase):
    def setUp(self):
        # Configure app for testing
        app.config['TESTING'] = True
        self.client = app.test_client()
        
        # Connect to the SQLite fallback DB and reset it to a clean test state
        self.db_path = db.DB_FILE_PATH
        # Ensure SQLite file exists and is populated
        with app.app_context():
            db_conn = db.get_db()
            # If it's the SQLite connection wrapper, reset it
            if isinstance(db_conn, db.SQLiteConnectionWrapper):
                # We can drop tables and re-init to ensure a clean starting slate
                conn = db_conn.conn
                cursor = conn.cursor()
                cursor.execute("DROP TABLE IF EXISTS transactions;")
                cursor.execute("DROP TABLE IF EXISTS books;")
                cursor.execute("DROP TABLE IF EXISTS users;")
                conn.commit()
                db.init_sqlite_tables(conn)

    def test_complete_library_workflow(self):
        print("\n--- Starting Automated Library Workflow Test ---")
        
        # ----------------------------------------------------
        # 0. Health Check
        # ----------------------------------------------------
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'UP')
        print("[PASS] Backend API Health Check is UP.")

        # ----------------------------------------------------
        # 1. Workflow A: Book Selection & QR Generation (Kiosk)
        # ----------------------------------------------------
        # The kiosk queries GET /api/books/pickup/<book_uid>
        response = self.client.get('/api/books/pickup/BK-ALG-101')
        self.assertEqual(response.status_code, 200)
        book = json.loads(response.data)
        self.assertEqual(book['book_uid'], 'BK-ALG-101')
        self.assertEqual(book['title'], 'Introduction to Algorithms')
        self.assertEqual(book['status'], 'available')
        self.assertIn('encrypted_payload', book)
        encrypted_qr_token = book['encrypted_payload']
        print(f"[PASS] Workflow A: Verified book '{book['title']}' is available. Received encrypted QR payload.")

        # ----------------------------------------------------
        # 2. Workflow B: Student Login & Checkout (Student Web App)
        # ----------------------------------------------------
        # Step 2a: Student Authenticates
        login_payload = {
            'roll_number': 'ST-2026-01',
            'password': 'hello'
        }
        response = self.client.post('/api/student/login', 
                                    data=json.dumps(login_payload),
                                    content_type='application/json')
        self.assertEqual(response.status_code, 200)
        login_data = json.loads(response.data)
        student_id = login_data['user']['id']
        student_token = login_data['token']
        self.assertEqual(login_data['user']['role'], 'student')
        print(f"[PASS] Workflow B: Student logged in successfully as '{login_data['user']['name']}'.")

        # Step 2b: Student Scans and Checks Out Book (sends raw encrypted QR token)
        checkout_payload = {
            'user_id': student_id,
            'book_id': encrypted_qr_token
        }
        response = self.client.post('/api/student/checkout',
                                    data=json.dumps(checkout_payload),
                                    content_type='application/json',
                                    headers={'Authorization': f'Bearer {student_token}'})
        if response.status_code != 200:
            print("Checkout Response Data:", response.data)
        self.assertEqual(response.status_code, 200)
        checkout_data = json.loads(response.data)
        self.assertIn('Book Successfully Checked Out', checkout_data['message'])
        print(f"[PASS] Workflow B: Book '{checkout_data['book']['title']}' successfully checked out.")

        # Step 2c: Verify book status is now 'checked_out'
        response = self.client.get('/api/books/pickup/BK-ALG-101')
        book = json.loads(response.data)
        self.assertEqual(book['status'], 'checked_out')
        print(f"[PASS] Workflow B: Verified book status changed to '{book['status']}'.")

        # Step 2d: Verify book appears in student's active checkouts
        response = self.client.get(f'/api/student/active-checkouts/{student_id}',
                                   headers={'Authorization': f'Bearer {student_token}'})
        self.assertEqual(response.status_code, 200)
        active_checkouts = json.loads(response.data)
        # The first checkout should be our new book
        self.assertTrue(any(c['book_uid'] == 'BK-ALG-101' for c in active_checkouts))
        print(f"[PASS] Workflow B: Book '{book['title']}' listed in student active checkouts.")

        # ----------------------------------------------------
        # 3. Workflow C: Return Process (Admin Dashboard)
        # ----------------------------------------------------
        # Step 3a: Admin logs in
        admin_login_payload = {
            'email': 'admin@library.com',
            'password': 'hello'
        }
        response = self.client.post('/api/admin/login',
                                    data=json.dumps(admin_login_payload),
                                    content_type='application/json')
        self.assertEqual(response.status_code, 200)
        admin_data = json.loads(response.data)
        admin_token = admin_data['token']
        self.assertEqual(admin_data['user']['role'], 'admin')
        print(f"[PASS] Workflow C: Administrator logged in successfully as '{admin_data['user']['name']}'.")

        # Step 3b: Admin retrieves active checkouts list to find the transaction ID
        response = self.client.get('/api/admin/active-checkouts',
                                   headers={'Authorization': f'Bearer {admin_token}'})
        self.assertEqual(response.status_code, 200)
        all_active_checkouts = json.loads(response.data)
        
        # Locate transaction for Satyam Kumar checking out BK-ALG-101
        target_transaction = None
        for tx in all_active_checkouts:
            if tx['student_roll'] == 'ST-2026-01' and tx['book_uid'] == 'BK-ALG-101':
                target_transaction = tx
                break
                
        self.assertIsNotNone(target_transaction)
        transaction_id = target_transaction['id']
        print(f"[PASS] Workflow C: Found active checkout transaction ID {transaction_id} for 'Introduction to Algorithms'.")

        # Step 3c: Admin marks the book as returned
        return_payload = {
            'transaction_id': transaction_id
        }
        response = self.client.post('/api/admin/return-book',
                                    data=json.dumps(return_payload),
                                    content_type='application/json',
                                    headers={'Authorization': f'Bearer {admin_token}'})
        self.assertEqual(response.status_code, 200)
        return_data = json.loads(response.data)
        self.assertEqual(return_data['transaction_id'], transaction_id)
        print("[PASS] Workflow C: Book marked as returned via Admin POST.")

        # Step 3d: Verify book status reverted to 'available'
        response = self.client.get('/api/books/pickup/BK-ALG-101')
        book = json.loads(response.data)
        self.assertEqual(book['status'], 'available')
        print(f"[PASS] Workflow C: Verified book status reverted to '{book['status']}'.")

        # Step 3e: Verify book no longer appears in active checkouts
        response = self.client.get('/api/admin/active-checkouts',
                                   headers={'Authorization': f'Bearer {admin_token}'})
        all_active_checkouts_after = json.loads(response.data)
        self.assertFalse(any(tx['id'] == transaction_id for tx in all_active_checkouts_after))
        print("[PASS] Workflow C: Verified transaction is cleared from active checkouts list.")
        
        print("--- Automated Library Workflow Test Completed Successfully ---\n")

if __name__ == '__main__':
    unittest.main()
