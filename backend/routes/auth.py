import os
import datetime
from functools import wraps
import jwt
from flask import request, jsonify

JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'super-secret-library-key-2026')
JWT_ALGORITHM = 'HS256'

def generate_token(user_id, role):
    """
    Generates a signed JWT token valid for 2 hours.
    """
    payload = {
        'sub': str(user_id),
        'role': role,
        'iat': datetime.datetime.utcnow(),
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=2)
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def token_required(role=None):
    """
    Flask route decorator to validate request Authorization headers.
    Verifies signature, expiration, and user role.
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            auth_header = request.headers.get('Authorization')
            
            if not auth_header:
                return jsonify({'message': 'Access token is missing.'}), 401
                
            try:
                # Expect 'Bearer <token>'
                token_type, token = auth_header.split(" ")
                if token_type.lower() != 'bearer':
                    return jsonify({'message': 'Invalid authorization header format.'}), 401
            except ValueError:
                return jsonify({'message': 'Authorization header must follow Bearer <token> format.'}), 401
                
            try:
                # Decode and verify payload
                payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
                
                # Check role validation if configured
                if role and payload.get('role') != role:
                    return jsonify({'message': 'Access denied. Unauthorized role privileges.'}), 403
                    
                # Store decoded token information in request context if needed
                request.current_user = payload
                
            except jwt.ExpiredSignatureError:
                return jsonify({'message': 'Access token has expired.'}), 401
            except jwt.InvalidTokenError:
                return jsonify({'message': 'Invalid access token.'}), 401
                
            return f(*args, **kwargs)
        return decorated
    return decorator
