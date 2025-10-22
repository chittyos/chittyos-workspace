#!/usr/bin/env python3
"""
Google Workspace Setup Script
Configures users, groups, and automation for ARIBIA LLC
"""

import csv
import json
import os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    'https://www.googleapis.com/auth/admin.directory.user',
    'https://www.googleapis.com/auth/admin.directory.group',
    'https://www.googleapis.com/auth/apps.groups.settings'
]

def authenticate():
    """Authenticate with Google Workspace Admin SDK"""
    creds = None

    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)

        with open('token.json', 'w') as token:
            token.write(creds.to_json())

    return creds

def create_groups(service):
    """Create Google Groups from entity list"""

    with open('groups/entity_groups.csv', 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            group_body = {
                'email': row['Group Email'],
                'name': row['Group Name'],
                'description': row['Description']
            }

            try:
                result = service.groups().insert(body=group_body).execute()
                print(f"✓ Created group: {row['Group Email']}")

                # Add owners
                owners = row['Owners'].split(';')
                for owner in owners:
                    member_body = {
                        'email': owner.strip(),
                        'role': 'OWNER'
                    }
                    service.members().insert(
                        groupKey=row['Group Email'],
                        body=member_body
                    ).execute()

            except Exception as e:
                print(f"✗ Error creating {row['Group Email']}: {e}")

def setup_collaborative_inbox(group_email):
    """Configure group as collaborative inbox"""
    # This requires Groups Settings API
    # Implementation depends on your specific needs
    pass

def main():
    print("Google Workspace Setup for ARIBIA LLC")
    print("=" * 40)

    creds = authenticate()
    service = build('admin', 'directory_v1', credentials=creds)

    print("\nCreating groups...")
    create_groups(service)

    print("\n✓ Setup complete!")
    print("\nNext steps:")
    print("1. Configure domain DNS records")
    print("2. Set up email migration")
    print("3. Configure SSO if needed")
    print("4. Set up automation scripts")

if __name__ == '__main__':
    main()
