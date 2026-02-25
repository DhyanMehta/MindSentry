"""
Comprehensive API Testing Script for Frontend Integration
Tests all endpoints with exact frontend schema expectations
"""
import requests
import json
from typing import Dict, Any

BASE_URL = "http://127.0.0.1:8000"

def print_section(title: str):
    """Print a formatted section header"""
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")

def print_test(test_name: str, passed: bool, details: str = ""):
    """Print test result"""
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"\n{status} | {test_name}")
    if details:
        print(f"  └─ {details}")

def test_response_format(response: requests.Response, expected_keys: list, test_name: str) -> bool:
    """Validate response has expected keys"""
    try:
        data = response.json()
        missing_keys = [key for key in expected_keys if key not in data]
        if missing_keys:
            print_test(test_name, False, f"Missing keys: {missing_keys}")
            return False
        print_test(test_name, True, f"All keys present: {expected_keys}")
        return True
    except Exception as e:
        print_test(test_name, False, f"Error: {e}")
        return False

def main():
    print_section("🚀 MINDSENTRY API TESTING - FRONTEND INTEGRATION")
    
    results = {"passed": 0, "failed": 0}
    
    # Test 1: Health Check
    print_section("TEST 1: Health Check")
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print_test("Health check", True, f"Status: {response.status_code}")
            results["passed"] += 1
        else:
            print_test("Health check", False, f"Status: {response.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_test("Health check", False, f"Error: {e}")
        results["failed"] += 1
    
    # Test 2: Signup with new schema (including confirmPassword)
    print_section("TEST 2: Signup with Frontend Schema")
    signup_email = f"frontend_test_{hash('test') % 10000}@example.com"
    signup_data = {
        "email": signup_email,
        "password": "TestPassword123",
        "confirmPassword": "TestPassword123"
    }
    
    print(f"Request body: {json.dumps(signup_data, indent=2)}")
    
    try:
        response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data)
        print(f"\nResponse Status: {response.status_code}")
        print(f"Response Body: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 201:
            # Validate response format matches frontend expectations
            expected_keys = ["user", "access_token", "token_type"]
            if test_response_format(response, expected_keys, "Signup response format"):
                results["passed"] += 1
                
                # Validate user object
                user = response.json()["user"]
                user_keys = ["id", "email"]
                if all(key in user for key in user_keys):
                    print_test("User object format", True, f"Keys: {user_keys}")
                    results["passed"] += 1
                else:
                    print_test("User object format", False, f"Missing keys in user object")
                    results["failed"] += 1
                
                # Save token for later tests
                token = response.json()["access_token"]
            else:
                results["failed"] += 1
        else:
            print_test("Signup", False, f"Status: {response.status_code}")
            results["failed"] += 1
            return
    except Exception as e:
        print_test("Signup", False, f"Error: {e}")
        results["failed"] += 1
        return
    
    # Test 3: Signup with mismatched passwords
    print_section("TEST 3: Signup Validation (Password Mismatch)")
    invalid_signup = {
        "email": "test_invalid@example.com",
        "password": "password123",
        "confirmPassword": "different_password"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/signup", json=invalid_signup)
        print(f"Response Status: {response.status_code}")
        print(f"Response Body: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 422:  # Validation error
            print_test("Password mismatch validation", True, "Correctly rejected mismatched passwords")
            results["passed"] += 1
        else:
            print_test("Password mismatch validation", False, "Should reject mismatched passwords")
            results["failed"] += 1
    except Exception as e:
        print_test("Password mismatch validation", False, f"Error: {e}")
        results["failed"] += 1
    
    # Test 4: Login
    print_section("TEST 4: Login with Frontend Schema")
    login_data = {
        "email": signup_email,
        "password": "TestPassword123"
    }
    
    print(f"Request body: {json.dumps(login_data, indent=2)}")
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        print(f"\nResponse Status: {response.status_code}")
        print(f"Response Body: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            expected_keys = ["user", "access_token", "token_type"]
            if test_response_format(response, expected_keys, "Login response format"):
                results["passed"] += 1
                token = response.json()["access_token"]
            else:
                results["failed"] += 1
        else:
            print_test("Login", False, f"Status: {response.status_code}")
            results["failed"] += 1
            return
    except Exception as e:
        print_test("Login", False, f"Error: {e}")
        results["failed"] += 1
        return
    
    # Test 5: Get Current User (Protected Route)
    print_section("TEST 5: Get Current User (Protected Route)")
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
        print(f"Response Status: {response.status_code}")
        print(f"Response Body: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            expected_keys = ["id", "email"]
            if test_response_format(response, expected_keys, "Get user response format"):
                results["passed"] += 1
                
                # Verify no timestamp in response (frontend doesn't need it)
                user_data = response.json()
                if "created_at" not in user_data:
                    print_test("No timestamp in response", True, "Clean response for frontend")
                    results["passed"] += 1
                else:
                    print_test("No timestamp in response", False, "Response includes unnecessary fields")
                    results["failed"] += 1
            else:
                results["failed"] += 1
        else:
            print_test("Get current user", False, f"Status: {response.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_test("Get current user", False, f"Error: {e}")
        results["failed"] += 1
    
    # Test 6: Invalid Token
    print_section("TEST 6: Invalid Token Handling")
    invalid_headers = {"Authorization": "Bearer invalid_token_12345"}
    
    try:
        response = requests.get(f"{BASE_URL}/auth/me", headers=invalid_headers)
        print(f"Response Status: {response.status_code}")
        
        if response.status_code == 401:
            print_test("Invalid token rejection", True, "Correctly rejected invalid token")
            results["passed"] += 1
        else:
            print_test("Invalid token rejection", False, f"Should return 401, got {response.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_test("Invalid token rejection", False, f"Error: {e}")
        results["failed"] += 1
    
    # Test 7: CORS Headers
    print_section("TEST 7: CORS Configuration")
    try:
        response = requests.options(f"{BASE_URL}/auth/login")
        cors_headers = {
            "access-control-allow-origin": response.headers.get("access-control-allow-origin"),
            "access-control-allow-methods": response.headers.get("access-control-allow-methods"),
            "access-control-allow-headers": response.headers.get("access-control-allow-headers"),
        }
        
        print(f"CORS Headers:")
        for key, value in cors_headers.items():
            print(f"  {key}: {value}")
        
        if cors_headers["access-control-allow-origin"]:
            print_test("CORS enabled", True, "CORS headers present")
            results["passed"] += 1
        else:
            print_test("CORS enabled", False, "CORS headers missing")
            results["failed"] += 1
    except Exception as e:
        print_test("CORS enabled", False, f"Error: {e}")
        results["failed"] += 1
    
    # Final Summary
    print_section("📊 TEST SUMMARY")
    total = results["passed"] + results["failed"]
    percentage = (results["passed"] / total * 100) if total > 0 else 0
    
    print(f"\nTotal Tests: {total}")
    print(f"✓ Passed: {results['passed']}")
    print(f"✗ Failed: {results['failed']}")
    print(f"Success Rate: {percentage:.1f}%")
    
    if results["failed"] == 0:
        print("\n🎉 ALL TESTS PASSED!")
        print("\n✅ Backend is ready for React Native frontend integration!")
        print("\nNext steps:")
        print("  1. Server is running at: http://127.0.0.1:8000")
        print("  2. API docs available at: http://127.0.0.1:8000/docs")
        print("  3. Update frontend API base URL to: http://127.0.0.1:8000")
        print("  4. Test with React Native app")
    else:
        print("\n⚠️  SOME TESTS FAILED")
        print("Review the failed tests above and fix issues before frontend integration.")
    
    print("\n" + "="*70 + "\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Tests interrupted by user")
    except Exception as e:
        print(f"\n\n❌ CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()
