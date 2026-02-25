"""
API Testing Script
Run this to verify all endpoints work correctly
"""
import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def print_result(title, response):
    """Print formatted test result"""
    print(f"\n{'='*60}")
    print(f"TEST: {title}")
    print(f"{'='*60}")
    print(f"Status Code: {response.status_code}")
    try:
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except:
        print(f"Response: {response.text}")
    print(f"{'='*60}")

def main():
    print("\n🚀 Starting API Tests...\n")
    
    # Test 1: Health Check
    print("\n[1/5] Testing Health Check...")
    response = requests.get(f"{BASE_URL}/")
    print_result("GET /", response)
    assert response.status_code == 200, "Health check failed!"
    
    # Test 2: Health Endpoint
    print("\n[2/5] Testing Health Endpoint...")
    response = requests.get(f"{BASE_URL}/health")
    print_result("GET /health", response)
    assert response.status_code == 200, "Health endpoint failed!"
    
    # Test 3: Signup
    print("\n[3/5] Testing User Signup...")
    signup_data = {
        "email": "testuser@example.com",
        "password": "SecurePassword123"
    }
    response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data)
    print_result("POST /auth/signup", response)
    
    if response.status_code == 201:
        token = response.json()["access_token"]
        print(f"\n✓ Signup successful! Got access token.")
    elif response.status_code == 400 and "already registered" in response.json().get("detail", ""):
        print(f"\n⚠ User already exists, trying login instead...")
        # Try login instead
        login_data = {
            "email": "testuser@example.com",
            "password": "SecurePassword123"
        }
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        if response.status_code == 200:
            token = response.json()["access_token"]
            print(f"✓ Login successful! Got access token.")
        else:
            print("✗ Login failed. Creating new user with different email...")
            signup_data["email"] = f"testuser{hash(signup_data['password']) % 10000}@example.com"
            response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data)
            assert response.status_code == 201, f"Signup failed: {response.text}"
            token = response.json()["access_token"]
    else:
        raise Exception(f"Signup failed with status {response.status_code}: {response.text}")
    
    # Test 4: Login
    print("\n[4/5] Testing User Login...")
    login_data = {
        "email": signup_data["email"],
        "password": signup_data["password"]
    }
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    print_result("POST /auth/login", response)
    assert response.status_code == 200, "Login failed!"
    token = response.json()["access_token"]
    
    # Test 5: Get Current User (Protected Route)
    print("\n[5/5] Testing Get Current User (Protected Route)...")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    print_result("GET /auth/me", response)
    assert response.status_code == 200, "Get current user failed!"
    
    # Test 6: Invalid Token
    print("\n[BONUS] Testing Invalid Token...")
    headers = {"Authorization": "Bearer invalid_token_here"}
    response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    print_result("GET /auth/me (Invalid Token)", response)
    assert response.status_code == 401, "Should reject invalid token!"
    
    print("\n" + "="*60)
    print("🎉 ALL TESTS PASSED!")
    print("="*60)
    print("\n✅ All API routes are working correctly!")
    print("\nEndpoints tested:")
    print("  ✓ GET  /          - Health check")
    print("  ✓ GET  /health    - Health status")
    print("  ✓ POST /auth/signup  - User registration")
    print("  ✓ POST /auth/login   - User authentication")
    print("  ✓ GET  /auth/me      - Get current user (protected)")
    print("\n📚 API Documentation: http://127.0.0.1:8000/docs")
    print()

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
