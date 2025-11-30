import firebase_admin
from firebase_admin import credentials, firestore
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_firebase_connection():
    try:
        # Initialize Firebase
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
        
        # Test Firestore connection
        db = firestore.client()
        
        # Try to read a document
        users_ref = db.collection("users").limit(1)
        docs = users_ref.stream()
        
        user_count = 0
        for doc in docs:
            user_count += 1
            logger.info(f"Found user: {doc.id} => {doc.to_dict()}")
        
        logger.info(f"Firebase connection successful! Found {user_count} users.")
        return True
        
    except Exception as e:
        logger.error(f"Firebase connection failed: {e}")
        return False

if __name__ == "__main__":
    test_firebase_connection()