import requests

def fix_admin_role():
    base_url = "http://127.0.0.1:8000"
    
    try:
        # Update admin user role directly via database API
        response = requests.patch(
            f"{base_url}/profiles/ADMIN001/status",
            json={"approval_status": "approved"},
            timeout=10
        )
        
        if response.status_code == 200:
            print("✓ Admin user status updated")
            
            # Now let's also update the role in the database directly
            # We need to add a role update endpoint or use the database directly
            
        else:
            print(f"✗ Failed to update admin: {response.text}")
            
    except Exception as e:
        print(f"✗ Error: {e}")

if __name__ == "__main__":
    print("Fixing admin user role...")
    fix_admin_role()
    print("Done!")
