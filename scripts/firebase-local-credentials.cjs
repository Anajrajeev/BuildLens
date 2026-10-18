// Explicit local-development setup: reuse the logged-in Firebase CLI account.
// The generated ADC credential is gitignored. Never deploy it or print it.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = process.env.APPDATA ? path.join(process.env.APPDATA, 'npm', 'node_modules', 'firebase-tools') : process.env.FIREBASE_TOOLS_PATH;
if (!root) throw new Error('Set FIREBASE_TOOLS_PATH to your firebase-tools installation.');
const req = createRequire(path.join(root, 'package.json'));
const auth = req('./lib/auth');
const api = req('./lib/api');
const account = auth.getGlobalDefaultAccount();
if (!account?.tokens?.refresh_token) throw new Error('Run firebase login first.');
const target = path.resolve(__dirname, '../backend/.firebase-local-credentials.json');
fs.writeFileSync(target, JSON.stringify({type: 'authorized_user', client_id: api.clientId(), client_secret: api.clientSecret(), refresh_token: account.tokens.refresh_token}), {mode: 0o600});
console.log('Local Firebase credential configured. Contents were not printed.');
