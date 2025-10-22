# Export all mailboxes to PST
$mailboxes = @(
    "nick@aribia.llc",
    "sharon@aribia.llc",
    "cynthia@chicagofurnishedcondos.com",
    "mgmt@aribia.llc",
    "mgmt@chicagofurnishedcondos.com",
    "mgmt@itcanbellc.com",
    "pay@byaribia.com",
    "legal@itcanbellc.com"
)

foreach ($mailbox in $mailboxes) {
    New-MailboxExportRequest -Mailbox $mailbox -FilePath "\\backup\$mailbox.pst"
}
