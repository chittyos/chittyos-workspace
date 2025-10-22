#!/usr/bin/env python3
"""
Quick Google Workspace Authentication Setup
Uses Application Default Credentials or interactive login
"""

import os
import json
from google.auth import default
from google.oauth2 import service_account
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

def try_authentication():
    """Try different authentication methods"""

    print("🔐 Attempting Google Workspace authentication...")

    # Method 1: Try Application Default Credentials
    try:
        print("\n1️⃣ Trying Application Default Credentials...")
        credentials, project = default(scopes=[
            'https://www.googleapis.com/auth/admin.directory.user',
            'https://www.googleapis.com/auth/admin.directory.group',
            'https://www.googleapis.com/auth/admin.directory.domain'
        ])

        service = build('admin', 'directory_v1', credentials=credentials)

        # Test access
        result = service.domains().list(customer='my_customer').execute()
        print("✅ Application Default Credentials working!")
        return credentials, service

    except Exception as e:
        print(f"❌ ADC failed: {e}")

    # Method 2: Check for service account file
    service_account_paths = [
        'service-account.json',
        'credentials.json',
        os.path.expanduser('~/.config/gcloud/service-account.json')
    ]

    for path in service_account_paths:
        if os.path.exists(path):
            try:
                print(f"\n2️⃣ Trying service account: {path}")
                credentials = service_account.Credentials.from_service_account_file(
                    path,
                    scopes=[
                        'https://www.googleapis.com/auth/admin.directory.user',
                        'https://www.googleapis.com/auth/admin.directory.group',
                        'https://www.googleapis.com/auth/admin.directory.domain'
                    ]
                )

                service = build('admin', 'directory_v1', credentials=credentials)
                result = service.domains().list(customer='my_customer').execute()
                print(f"✅ Service account working: {path}")
                return credentials, service

            except Exception as e:
                print(f"❌ Service account failed: {e}")

    # Method 3: Use gcloud auth
    try:
        print("\n3️⃣ Trying gcloud application-default login...")
        os.system('gcloud auth application-default login --scopes=https://www.googleapis.com/auth/admin.directory.user,https://www.googleapis.com/auth/admin.directory.group,https://www.googleapis.com/auth/admin.directory.domain')

        credentials, project = default()
        service = build('admin', 'directory_v1', credentials=credentials)
        result = service.domains().list(customer='my_customer').execute()
        print("✅ gcloud auth working!")
        return credentials, service

    except Exception as e:
        print(f"❌ gcloud auth failed: {e}")

    return None, None

def test_workspace_access(service):
    """Test Google Workspace access"""
    print("\n🧪 Testing Google Workspace access...")

    try:
        # Test domains
        domains = service.domains().list(customer='my_customer').execute()
        print(f"✅ Found {len(domains.get('domains', []))} domains:")
        for domain in domains.get('domains', []):
            print(f"   • {domain['domainName']} ({domain['verified']})")

        # Test users
        users = service.users().list(customer='my_customer', maxResults=10).execute()
        print(f"✅ Found {len(users.get('users', []))} users (showing first 10)")

        # Test groups
        groups = service.groups().list(customer='my_customer', maxResults=10).execute()
        print(f"✅ Found {len(groups.get('groups', []))} groups (showing first 10)")

        return True

    except Exception as e:
        print(f"❌ Workspace access test failed: {e}")
        return False

def main():
    print("🚀 Google Workspace Quick Authentication Test")
    print("=" * 50)

    credentials, service = try_authentication()

    if credentials and service:
        if test_workspace_access(service):
            print("\n✨ Authentication successful!")
            print("You can now run: python3 automated_google_setup.py")

            # Save credentials for the main script
            with open('auth_working.json', 'w') as f:
                json.dump({'status': 'authenticated'}, f)

        else:
            print("\n❌ Authentication failed - insufficient permissions")
    else:
        print("\n❌ Could not authenticate")
        print("\nManual steps needed:")
        print("1. Go to: https://console.cloud.google.com")
        print("2. Enable Admin SDK API")
        print("3. Create OAuth credentials")
        print("4. Download as credentials.json")

if __name__ == '__main__':
    main()