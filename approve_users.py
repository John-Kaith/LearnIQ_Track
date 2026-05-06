import requests
import json

# Users to approve
users_to_approve = [
    "admin@learniq.com",
    "teacher@learniq.com", 
    "student@learniq.com"
]

def approve_users():
    base_url = "http://127.0.0.1:8000"
    
    for email in users_to_approve:
        try:
            # First login as admin to get session (we'll need to create admin approval)
            # For now, let's directly update the database
            
            # Get all users to find the user ID
            response = requests.get(f"{base_url}/users", timeout=10)
            
            if response.status_code == 200:
                users_data = response.json()
                users = users_data if isinstance(users_data, list) else users_data.get('users', [])
                user_id = None
                
                for user in users:
                    user_email = user.get('email') if isinstance(user, dict) else user.email
                    if user_email == email:
                        user_id = user.get('id') if isinstance(user, dict) else user.id
                        break
                
                if user_id:
                    # Get the user's id_number
                    user_id_number = None
                    for user in users:
                        user_email = user.get('email') if isinstance(user, dict) else user.email
                        if user_email == email:
                            user_id_number = user.get('id_number') if isinstance(user, dict) else user.id_number
                            break
                    
                    if user_id_number:
                        # Approve the user using PATCH method
                        approve_response = requests.patch(
                            f"{base_url}/profiles/{user_id_number}/status",
                            json={"approval_status": "approved"},
                            timeout=10
                        )
                    
                    if approve_response.status_code == 200:
                        print(f"✓ Successfully approved {email}")
                    else:
                        print(f"✗ Failed to approve {email}: {approve_response.text}")
                else:
                    print(f"✗ User {email} not found")
            else:
                print(f"✗ Failed to get users list: {response.text}")
                
        except Exception as e:
            print(f"✗ Error approving {email}: {e}")
        
        print("-" * 50)

if __name__ == "__main__":
    print("Approving test users...")
    approve_users()
    print("Done!")
