const os = require('os');
const fs = require('fs');
const path = require('path');

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    // Skip WSL, Hyper-V, Docker, and internal interfaces
    const lowerName = name.toLowerCase();
    if (lowerName.includes('wsl') || lowerName.includes('veth') || lowerName.includes('hyper-v') || lowerName.includes('docker')) {
      continue;
    }
    
    for (const iface of interfaces[name]) {
      // Look for IPv4 and non-internal
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

const ip = getLocalIpAddress();
if (!ip) {
  console.warn('⚠️ Could not automatically determine local IP address. Skipping .env.local update.');
  process.exit(0);
}

const envPath = path.join(__dirname, '..', '.env.local');
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}

const newLine = `EXPO_PUBLIC_BACKEND_API_URL="http://${ip}:8000"`;
const regex = /^EXPO_PUBLIC_BACKEND_API_URL=.*$/m;

if (regex.test(envContent)) {
  envContent = envContent.replace(regex, newLine);
} else {
  // Ensure there's a newline before appending if content exists and doesn't end with one
  if (envContent && !envContent.endsWith('\n')) {
    envContent += '\n';
  }
  envContent += `${newLine}\n`;
}

fs.writeFileSync(envPath, envContent, 'utf8');
console.log(`✅ Automatically updated backend API to http://${ip}:8000 in .env.local`);
