import os
import sqlite3
import pymysql
from flask import g
from dotenv import load_dotenv

# Ensure dotenv is loaded
load_dotenv()

DB_FILE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'library_access_sqlite.db')

class SQLiteCursorWrapper:
    def __init__(self, sqlite_cursor):
        self.cursor = sqlite_cursor

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.cursor.close()

    def execute(self, query, params=None):
        # 1. Translate %s to ? placeholders for SQLite
        translated_query = query.replace('%s', '?')

        # 2. Translate MySQL-specific date functions to SQLite equivalents
        translated_query = translated_query.replace(
            'DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 14 DAY)',
            "datetime('now', '+14 days')"
        )
        translated_query = translated_query.replace('CURRENT_TIMESTAMP', "datetime('now')")

        if params is not None:
            if not isinstance(params, (list, tuple)):
                params = (params,)
            self.cursor.execute(translated_query, params)
        else:
            self.cursor.execute(translated_query)
        return self

    def fetchone(self):
        row = self.cursor.fetchone()
        if row is None:
            return None
        return dict(row)

    def fetchall(self):
        rows = self.cursor.fetchall()
        return [dict(row) for row in rows]

class SQLiteConnectionWrapper:
    def __init__(self, sqlite_conn):
        self.conn = sqlite_conn

    def cursor(self, *args, **kwargs):
        # Ignore cursorclass arguments for SQLite compatibility
        cursor = self.conn.cursor()
        return SQLiteCursorWrapper(cursor)

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def close(self):
        self.conn.close()

def get_db():
    """
    Get a database connection from Flask request global context.
    Attempts to connect to MySQL. If connection fails, falls back to local SQLite.
    """
    if 'db' not in g:
        try:
            # Try to connect to MySQL
            g.db = pymysql.connect(
                host=os.getenv('DB_HOST', 'localhost'),
                user=os.getenv('DB_USER', 'root'),
                password=os.getenv('DB_PASSWORD', ''),
                database=os.getenv('DB_NAME', 'library_access_db'),
                cursorclass=pymysql.cursors.DictCursor,
                connect_timeout=1
            )
            print("[Database] Successfully connected to MySQL database.")
        except Exception as e:
            print("====================================================")
            print("[MySQL connection failed! Falling back to SQLite]")
            print(f"Error Details: {str(e)}")
            print(f"SQLite DB File: {DB_FILE_PATH}")
            print("====================================================")
            
            # Initialize SQLite connection
            conn = sqlite3.connect(DB_FILE_PATH)
            conn.row_factory = sqlite3.Row
            # Enable Foreign Keys in SQLite
            conn.execute("PRAGMA foreign_keys = ON;")
            g.db = SQLiteConnectionWrapper(conn)
            
            # Ensure tables and seed data are initialized
            init_sqlite_tables(conn)
            
    return g.db

def close_db(e=None):
    """
    Close the database connection if it was initialized for the current request.
    """
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_app(app):
    """
    Register teardown handler with the Flask application context.
    """
    app.teardown_appcontext(close_db)

def init_sqlite_tables(conn):
    """
    Initializes SQLite schema and seeds mock data if they do not exist.
    """
    cursor = conn.cursor()
    
    # 1. Create Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roll_number TEXT UNIQUE DEFAULT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'admin')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Create Books Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_uid TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      slot_location TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('available', 'checked_out', 'maintenance')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. Create Transactions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      checkout_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      due_time TIMESTAMP NOT NULL,
      return_time TIMESTAMP DEFAULT NULL,
      status TEXT NOT NULL CHECK(status IN ('active', 'returned', 'overdue')),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
    );
    """)
    conn.commit()

    # 4. Create Fines Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS fines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      fine_amount REAL NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('unpaid', 'paid')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE
    );
    """)
    conn.commit()

    # 5. Check if we need to seed mock data
    cursor.execute("SELECT COUNT(*) as count FROM users")
    if cursor.fetchone()[0] == 0:
        print("[SQLite Seed] Seeding mock users...")
        users_data = [
            (1, None, 'Library Admin', 'admin@library.com', '$2b$12$R9hKbEv18zTf.eBPQfJyV.2qHh/fD59yNshU3m401aY2vIq2k0P1K', 'admin'),
            (2, 'ST-2026-01', 'Satyam Kumar', 'satyam@library.com', '$2b$12$K8yX.a9P2Q.dJ4w2rFv1Ze2mHh/fD59yNshU3m401aY2vIq2k0P2L', 'student'),
            (3, 'ST-2026-02', 'Dipak Shinde', 'dipak@library.com', '$2b$12$W9zV.b8O1P.eI3v1qEu0Yd1lGg/eC48xMrgT2l390zX1uHp1j9O3M', 'student'),
            (4, 'ST-2026-03', 'Rohan Sharma', 'rohan@library.com', '$2b$12$M7xU.c7N0O.dH2u0pDt9Xc0kFf/dB37wLqfS1k280yW0tGo0i8N2K', 'student')
        ]
        cursor.executemany(
            "INSERT INTO users (id, roll_number, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)",
            users_data
        )
        conn.commit()

    cursor.execute("SELECT COUNT(*) as count FROM books")
    if cursor.fetchone()[0] == 0:
        print("[SQLite Seed] Seeding mock books...")
        # Start with standard books
        books_data = [
            (1, 'BK-ALG-101', 'Introduction to Algorithms', 'Thomas H. Cormen', 'Row 1, Shelf A', 'available'),
            (2, 'BK-CCN-202', 'Clean Code', 'Robert C. Martin', 'Row 2, Shelf B', 'checked_out'),
            (3, 'BK-DP-303', 'Design Patterns', 'Erich Gamma', 'Row 2, Shelf C', 'available'),
            (4, 'BK-PP-404', 'The Pragmatic Programmer', 'Andrew Hunt', 'Row 3, Shelf A', 'available'),
            (5, 'BK-JSGP-505', 'JavaScript: The Good Parts', 'Douglas Crockford', 'Row 3, Shelf B', 'maintenance')
        ]
        cursor.executemany(
            "INSERT INTO books (id, book_uid, title, author, slot_location, status) VALUES (?, ?, ?, ?, ?, ?)",
            books_data
        )
        
        # Add cybersecurity books
        cybersecurity_books = [
            ('BK-CYB-601', "The Web Application Hacker's Handbook", 'Dafydd Stuttard', 'Row 4, Shelf A', 'available'),
            ('BK-CYB-602', 'Hacking: The Art of Exploitation', 'Jon Erickson', 'Row 4, Shelf B', 'available'),
            ('BK-CYB-603', 'Practical Malware Analysis', 'Michael Sikorski', 'Row 4, Shelf C', 'available'),
            ('BK-CYB-604', 'The Art of Invisibility', 'Kevin Mitnick', 'Row 5, Shelf A', 'available'),
            ('BK-CYB-605', 'Social Engineering: The Science of Human Hacking', 'Christopher Hadnagy', 'Row 5, Shelf B', 'available'),
            ('BK-CYB-606', 'Applied Cryptography', 'Bruce Schneier', 'Row 5, Shelf C', 'available')
        ]
        cursor.executemany(
            "INSERT INTO books (book_uid, title, author, slot_location, status) VALUES (?, ?, ?, ?, ?)",
            cybersecurity_books
        )
        conn.commit()

        # Seed an active transaction for BK-CCN-202 (Clean Code, book_id=2) checked out by Satyam (user_id=2)
        # due date: 14 days from now
        cursor.execute("""
        INSERT INTO transactions (user_id, book_id, checkout_time, due_time, status)
        VALUES (2, 2, datetime('now'), datetime('now', '+14 days'), 'active')
        """)
        conn.commit()
        print("[SQLite Seed] Seeding completed.")
