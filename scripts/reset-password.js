/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');

try {
  let content = fs.readFileSync('.env', 'utf-8');
  // Replace the password hash with the bcrypt hash for 'password123'
  // using regex to match exact setting.
  content = content.replace(/OWNER_PASSWORD_HASH="[^"]*"/g, 'OWNER_PASSWORD_HASH="$2b$12$UPxLcNK8Q5/XDAtK1SyoU.8pUUrtFEB2bwdhC1UFV4Siy0I1wfvZqy"');
  
  if (!content.includes('OWNER_PASSWORD_HASH=')) {
    content += '\nOWNER_PASSWORD_HASH="$2b$12$UPxLcNK8Q5/XDAtK1SyoU.8pUUrtFEB2bwdhC1UFV4Siy0I1wfvZqy"';
  }

  // Also extract the email to let the user know what email to use.
  const emailMatch = content.match(/OWNER_EMAIL="([^"]+)"/);
  if (emailMatch) {
    console.log(`Email found: ${emailMatch[1]}`);
  } else {
    console.log('No OWNER_EMAIL found in config.');
  }

  fs.writeFileSync('.env', content, 'utf-8');
  console.log('Password hash successfully reset to "password123".');
} catch(e) {
  console.error("Error reading or writing to .env", e);
}
