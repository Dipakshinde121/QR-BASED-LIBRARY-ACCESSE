import os
import json
from cryptography.fernet import Fernet, InvalidToken

# Use environmental key if configured; otherwise use static fallback
QR_ENCRYPTION_KEY = os.getenv('QR_ENCRYPTION_KEY', 'Op3ob-qUHFyWRuEBOuGS-L3l8T8CbtDtGVoIAe87vgc=')

# Initialize Fernet cipher suite
cipher_suite = Fernet(QR_ENCRYPTION_KEY.encode('utf-8'))

def encrypt_payload(data_dict):
    """
    Encrypts a dictionary payload into an encrypted Fernet token string.
    """
    json_str = json.dumps(data_dict)
    encrypted_bytes = cipher_suite.encrypt(json_str.encode('utf-8'))
    return encrypted_bytes.decode('utf-8')

def decrypt_payload(token_str):
    """
    Decrypts an encrypted Fernet token string and returns the deserialized dictionary.
    Returns None if decryption fails.
    """
    try:
        decrypted_bytes = cipher_suite.decrypt(token_str.encode('utf-8'))
        return json.loads(decrypted_bytes.decode('utf-8'))
    except (InvalidToken, Exception) as e:
        print("[Crypto Helper] Decryption failed:", str(e))
        return None
