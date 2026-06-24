import os
import datetime
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load env variables from .env
load_dotenv()

# Import db and blueprints
import db
from routes.books import books_bp
from routes.admin import admin_bp
from routes.student import student_bp

app = Flask(__name__)
PORT = int(os.getenv('PORT', 5000))

# Enable CORS for all routes
CORS(app)

# Initialize database context lifecycle
db.init_app(app)

# Register Blueprints
app.register_blueprint(books_bp, url_prefix='/api/books')
app.register_blueprint(admin_bp, url_prefix='/api/admin')
app.register_blueprint(student_bp, url_prefix='/api/student')

# Start background due reminders scheduler
import reminders
reminders.init_scheduler(app)

# Basic health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'UP',
        'message': 'Library Kiosk API is running smoothly.',
        'timestamp': datetime.datetime.now().isoformat()
    }), 200

# Root route
@app.route('/', methods=['GET'])
def root_route():
    return 'Library Kiosk Backend Server is Active.'

if __name__ == '__main__':
    print(f'Server is running on port {PORT}')
    # Turn off debug mode reloader to avoid initial database connection log duplication
    app.run(host='0.0.0.0', port=PORT, debug=False)
