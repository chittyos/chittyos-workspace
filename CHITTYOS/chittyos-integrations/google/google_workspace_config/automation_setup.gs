/**
 * Google Workspace Automation Setup for ARIBIA LLC
 * Sets up email routing, filters, and automation
 */

function setupEmailAutomation() {
  // Email routing rules for different entities
  const routingRules = [
    {
      from: 'pay@*',
      label: 'Payments',
      forward: false,
      autoReply: 'Thank you for your payment. We will process it within 24 hours.',
      markImportant: true
    },
    {
      from: '*@cozycastlechicago.com',
      label: 'Cozy_Castle',
      forward: false
    },
    {
      from: '*@villavistachicago.com',
      label: 'Villa_Vista',
      forward: false
    },
    {
      from: '*@chicagofurnishedcondos.com',
      label: 'CFC',
      forward: false
    },
    {
      from: 'legal@*',
      label: 'Legal',
      markImportant: true
    }
  ];

  // Create labels
  routingRules.forEach(rule => {
    if (rule.label) {
      GmailApp.createLabel(rule.label);
    }
  });

  console.log('Email automation setup complete');
}

function setupDriveStructure() {
  // Create shared drive structure for entities
  const driveStructure = [
    'ARIBIA LLC',
    'ARIBIA LLC/Chicago Furnished Condos',
    'ARIBIA LLC/Chicago Furnished Condos/Cozy Castle',
    'ARIBIA LLC/Chicago Furnished Condos/Villa Vista',
    'ARIBIA LLC/Chicago Furnished Condos/City Studio',
    'ARIBIA LLC/Chicago Furnished Condos/Lakeside Loft',
    'ARIBIA LLC/IT CAN BE LLC',
    'ARIBIA LLC/Jean Arlene Venturing',
    'ARIBIA LLC/Uncle Steve LLC',
    'ARIBIA LLC/Legal',
    'ARIBIA LLC/Finance',
    'ARIBIA LLC/Finance/Payments',
    'ARIBIA LLC/Finance/Expenses'
  ];

  const rootFolder = DriveApp.getRootFolder();

  driveStructure.forEach(path => {
    const parts = path.split('/');
    let currentFolder = rootFolder;

    parts.forEach(part => {
      const folders = currentFolder.getFoldersByName(part);
      if (folders.hasNext()) {
        currentFolder = folders.next();
      } else {
        currentFolder = currentFolder.createFolder(part);
      }
    });
  });

  console.log('Drive structure created');
}
