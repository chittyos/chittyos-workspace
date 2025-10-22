#!/bin/bash

# Microsoft 365 Configuration Export Script (Mac/Linux)
# Uses Microsoft Graph API via Azure CLI

echo "=== Microsoft 365 Configuration Export (Mac/Linux) ==="
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "Azure CLI not found. Installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install azure-cli
    else
        curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
    fi
fi

# Create export directory
EXPORT_DIR="./MS365_Export_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EXPORT_DIR"

echo "Export folder: $EXPORT_DIR"
echo ""

# Login to Azure
echo "Logging into Microsoft 365..."
az login

# Set the tenant (you'll need to update this with your tenant ID)
echo "Enter your Microsoft 365 tenant ID (or domain):"
read TENANT_ID

# Function to make Graph API calls
graph_api_call() {
    local endpoint=$1
    local output_file=$2

    az rest --method GET \
        --uri "https://graph.microsoft.com/v1.0/$endpoint" \
        --headers "Content-Type=application/json" | \
        jq '.' > "$EXPORT_DIR/$output_file"
}

echo ""
echo "Exporting configuration..."

# 1. Export Users
echo "→ Exporting users..."
graph_api_call "users?\$select=displayName,userPrincipalName,mail,accountEnabled" "users.json"

# 2. Export Groups (including shared mailboxes)
echo "→ Exporting groups and shared mailboxes..."
graph_api_call "groups?\$filter=groupTypes/any(c:c+eq+'Unified')" "groups.json"

# 3. Export Domains
echo "→ Exporting domains..."
graph_api_call "domains" "domains.json"

# 4. Export Mail-enabled groups
echo "→ Exporting mail-enabled groups..."
graph_api_call "groups?\$filter=mailEnabled eq true" "mail_groups.json"

# 5. Export Organization Info
echo "→ Exporting organization info..."
graph_api_call "organization" "organization.json"

# 6. Export SharePoint Sites
echo "→ Exporting SharePoint sites..."
graph_api_call "sites?\$select=displayName,name,webUrl,createdDateTime" "sharepoint_sites.json"

# 7. Export OneDrive Usage
echo "→ Checking OneDrive storage..."
graph_api_call "reports/getOneDriveUsageAccountDetail(period='D7')" "onedrive_usage.csv"

# Generate Python script for detailed analysis
cat > "$EXPORT_DIR/analyze_export.py" << 'EOF'
#!/usr/bin/env python3
import json
import csv
import os
from datetime import datetime

def analyze_ms365_export():
    """Analyze the exported Microsoft 365 data"""

    export_dir = os.path.dirname(os.path.abspath(__file__))

    # Read users
    with open(f"{export_dir}/users.json", 'r') as f:
        users_data = json.load(f)
        users = users_data.get('value', [])

    # Read groups
    with open(f"{export_dir}/groups.json", 'r') as f:
        groups_data = json.load(f)
        groups = groups_data.get('value', [])

    # Read domains
    with open(f"{export_dir}/domains.json", 'r') as f:
        domains_data = json.load(f)
        domains = domains_data.get('value', [])

    # Generate summary
    summary = f"""
Microsoft 365 Configuration Analysis
=====================================
Export Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

USERS
-----
Total Users: {len(users)}
Active Users: {len([u for u in users if u.get('accountEnabled')])}

User List:
{chr(10).join([f"  - {u.get('displayName', 'N/A')} ({u.get('userPrincipalName', 'N/A')})" for u in users])}

GROUPS & SHARED MAILBOXES
-------------------------
Total Groups: {len(groups)}

Group List:
{chr(10).join([f"  - {g.get('displayName', 'N/A')} ({g.get('mail', 'N/A')})" for g in groups if g.get('mail')])}

DOMAINS
-------
Verified Domains: {len([d for d in domains if d.get('isVerified')])}

Domain List:
{chr(10).join([f"  - {d.get('id', 'N/A')} ({'Verified' if d.get('isVerified') else 'Not Verified'})" for d in domains])}

MIGRATION CHECKLIST
------------------
□ Export mailbox data (PST files)
□ Document email forwarding rules
□ Export SharePoint/OneDrive files
□ Note custom domain settings
□ Document distribution lists
□ Export calendar data
□ Document third-party integrations
"""

    # Write summary
    with open(f"{export_dir}/ANALYSIS_SUMMARY.txt", 'w') as f:
        f.write(summary)

    print(summary)

    # Create migration mapping CSV
    with open(f"{export_dir}/migration_mapping.csv", 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['Type', 'Microsoft 365', 'Google Workspace', 'Notes'])

        for user in users:
            writer.writerow([
                'User',
                user.get('userPrincipalName', ''),
                user.get('userPrincipalName', ''),  # Will keep same email
                'Migrate mailbox data'
            ])

        for group in groups:
            if group.get('mail'):
                writer.writerow([
                    'Group/Shared Mailbox',
                    group.get('mail', ''),
                    group.get('mail', ''),  # Convert to Google Group
                    'Convert to Google Group'
                ])

if __name__ == "__main__":
    analyze_ms365_export()
EOF

chmod +x "$EXPORT_DIR/analyze_export.py"

# Run the analysis
echo ""
echo "Running analysis..."
python3 "$EXPORT_DIR/analyze_export.py"

echo ""
echo "✓ Export complete! Check folder: $EXPORT_DIR"
echo ""
echo "Next steps:"
echo "1. Review ANALYSIS_SUMMARY.txt for your configuration"
echo "2. Use migration_mapping.csv to plan your Google Workspace setup"
echo "3. Export PST files from Outlook for email data"
echo "4. Run the Google Workspace setup script"