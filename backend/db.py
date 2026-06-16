import os
import pymysql
from flask import g
from dotenv import load_dotenv

# Ensure dotenv is loaded
load_dotenv()

def get_db():
    """
    Get a database connection from Flask request global context.
    If no connection is active in the current request, establish one.
    """
    if 'db' not in g:
        try:
            g.db = pymysql.connect(
                host=os.getenv('DB_HOST', 'localhost'),
                user=os.getenv('DB_USER', 'root'),
                password=os.getenv('DB_PASSWORD', ''),
                database=os.getenv('DB_NAME', 'library_access_db'),
                cursorclass=pymysql.cursors.DictCursor
            )
        except Exception as e:
            print("====================================================")
            print("[Database connection failed!]")
            print("Error Details:", str(e))
            print("Please verify your MySQL server is running (e.g. via XAMPP).")
            print("====================================================")
            raise e
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
