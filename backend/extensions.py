from flask_socketio import SocketIO

# Initialize SocketIO instance to be shared across Blueprints
socketio = SocketIO(cors_allowed_origins="*")
