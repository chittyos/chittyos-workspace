# Microsoft 365 Configuration Export Script
# Exports all relevant configuration for Google Workspace migration

# Install required modules if not present
$modules = @('ExchangeOnlineManagement', 'Microsoft.Online.SharePoint.PowerShell', 'MicrosoftTeams', 'MSOnline')
foreach ($module in $modules) {
    if (!(Get-Module -ListAvailable -Name $module)) {
        Write-Host "Installing $module..." -ForegroundColor Yellow
        Install-Module -Name $module -Force -AllowClobber
    }
}

# Create export directory
$exportPath = ".\MS365_Export_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $exportPath -Force | Out-Null

Write-Host "`n=== Microsoft 365 Configuration Export ===" -ForegroundColor Cyan
Write-Host "Export folder: $exportPath" -ForegroundColor Green

# Connect to services
Write-Host "`nConnecting to Microsoft 365 services..." -ForegroundColor Yellow
Connect-ExchangeOnline
Connect-MsolService

# 1. Export User List
Write-Host "`nExporting users..." -ForegroundColor Yellow
Get-MsolUser -All | Select-Object DisplayName, UserPrincipalName, Licenses, IsLicensed, BlockCredential |
    Export-Csv "$exportPath\users.csv" -NoTypeInformation

# 2. Export Shared Mailboxes (Entity Accounts)
Write-Host "Exporting shared mailboxes..." -ForegroundColor Yellow
Get-Mailbox -RecipientTypeDetails SharedMailbox |
    Select-Object DisplayName, PrimarySmtpAddress, EmailAddresses, WhenCreated |
    Export-Csv "$exportPath\shared_mailboxes.csv" -NoTypeInformation

# 3. Export Distribution Groups
Write-Host "Exporting distribution groups..." -ForegroundColor Yellow
Get-DistributionGroup | Select-Object DisplayName, PrimarySmtpAddress, ManagedBy, Members |
    Export-Csv "$exportPath\distribution_groups.csv" -NoTypeInformation

# 4. Export Email Forwarding Rules
Write-Host "Exporting email forwarding rules..." -ForegroundColor Yellow
Get-Mailbox -ResultSize Unlimited |
    Select-Object DisplayName, ForwardingAddress, ForwardingSmtpAddress, DeliverToMailboxAndForward |
    Where-Object {$_.ForwardingAddress -ne $null -or $_.ForwardingSmtpAddress -ne $null} |
    Export-Csv "$exportPath\forwarding_rules.csv" -NoTypeInformation

# 5. Export Mailbox Permissions
Write-Host "Exporting mailbox permissions..." -ForegroundColor Yellow
$mailboxes = Get-Mailbox -ResultSize Unlimited
$permissions = @()
foreach ($mailbox in $mailboxes) {
    $perms = Get-MailboxPermission -Identity $mailbox.PrimarySmtpAddress |
        Where-Object {$_.User -notlike "NT AUTHORITY\*" -and $_.User -notlike "S-1-5-*"}
    foreach ($perm in $perms) {
        $permissions += [PSCustomObject]@{
            Mailbox = $mailbox.PrimarySmtpAddress
            User = $perm.User
            AccessRights = $perm.AccessRights -join ','
        }
    }
}
$permissions | Export-Csv "$exportPath\mailbox_permissions.csv" -NoTypeInformation

# 6. Export Send As Permissions
Write-Host "Exporting Send As permissions..." -ForegroundColor Yellow
Get-RecipientPermission -ResultSize Unlimited |
    Where-Object {$_.Trustee -ne "NT AUTHORITY\SELF"} |
    Select-Object Identity, Trustee, AccessRights |
    Export-Csv "$exportPath\sendas_permissions.csv" -NoTypeInformation

# 7. Export Domains
Write-Host "Exporting domains..." -ForegroundColor Yellow
Get-MsolDomain | Select-Object Name, Status, Authentication, Capabilities |
    Export-Csv "$exportPath\domains.csv" -NoTypeInformation

# 8. Export Mail Flow Rules
Write-Host "Exporting mail flow rules..." -ForegroundColor Yellow
Get-TransportRule | Select-Object Name, State, Priority, Description, Conditions, Actions |
    Export-Csv "$exportPath\mail_flow_rules.csv" -NoTypeInformation

# 9. Export Mailbox Sizes
Write-Host "Exporting mailbox sizes..." -ForegroundColor Yellow
Get-Mailbox -ResultSize Unlimited | Get-MailboxStatistics |
    Select-Object DisplayName, TotalItemSize, ItemCount, LastLogonTime |
    Export-Csv "$exportPath\mailbox_sizes.csv" -NoTypeInformation

# 10. Generate Summary Report
Write-Host "`nGenerating summary report..." -ForegroundColor Yellow
$summary = @"
Microsoft 365 Configuration Summary
====================================
Export Date: $(Get-Date)

USERS
-----
Total Users: $((Get-MsolUser -All).Count)
Licensed Users: $((Get-MsolUser -All | Where-Object {$_.IsLicensed -eq $true}).Count)

MAILBOXES
---------
Regular Mailboxes: $((Get-Mailbox -RecipientTypeDetails UserMailbox).Count)
Shared Mailboxes: $((Get-Mailbox -RecipientTypeDetails SharedMailbox).Count)
Distribution Groups: $((Get-DistributionGroup).Count)

DOMAINS
-------
$((Get-MsolDomain | Where-Object {$_.Status -eq "Verified"}).Name -join "`n")

DATA SIZE
---------
Total Mailbox Size: $((Get-Mailbox -ResultSize Unlimited | Get-MailboxStatistics | Measure-Object TotalItemSize -Sum).Sum)

FILES EXPORTED
--------------
$(Get-ChildItem $exportPath -Name -Filter "*.csv" | ForEach-Object {"- $_"} | Out-String)
"@

$summary | Out-File "$exportPath\SUMMARY.txt"
Write-Host $summary -ForegroundColor Cyan

# Disconnect sessions
Disconnect-ExchangeOnline -Confirm:$false

Write-Host "`n✓ Export complete! Check folder: $exportPath" -ForegroundColor Green
Write-Host "Next step: Run the Google Workspace setup script" -ForegroundColor Yellow