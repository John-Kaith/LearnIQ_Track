import requests
import json

# Test user data
test_users = [
    {
        "full_name": "Admin User",
        "id_number": "ADMIN001", 
        "email": "admin@learniq.com",
        "password": "admin123",
        "role": "admin"
    },
    {
        "full_name": "Teacher User",
        "id_number": "TEACH001",
        "email": "teacher@learniq.com", 
        "password": "teacher123",
        "role": "teacher"
    },
    {
        "full_name": "Student User",
        "id_number": "STUD001",
        "email": "student@learniq.com",
        "password": "student123", 
        "role": "student"
    }
]

def create_test_users():
    base_url = "http://127.0.0.1:8000"
    
    for user in test_users:
        try:
            # Register user
            response = requests.post(
                f"{base_url}/register",
                json=user,
                timeout=10
            )
            
            if response.status_code == 200:
                print(f"✓ Successfully registered {user['email']}")
                print(f"  Response: {response.json()}")
            else:
                print(f"✗ Failed to register {user['email']}")
                print(f"  Status: {response.status_code}")
                print(f"  Error: {response.text}")
                
        except Exception as e:
            print(f"✗ Error registering {user['email']}: {e}")
        
        print("-" * 50)

if __name__ == "__main__":
    print("Creating test users...")
    create_test_users()
    print("Done!")
