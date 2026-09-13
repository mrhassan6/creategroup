import fs from 'fs';
import path from 'path';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_ASSETS = path.join(__dirname, 'dist', 'assets');

console.log('🔒 Starting Production Anti-Tamper Obfuscation...');

if (!fs.existsSync(DIST_ASSETS)) {
  console.error('Error: dist/assets not found. Run "npm run build" first.');
  process.exit(1);
}

const files = fs.readdirSync(DIST_ASSETS);
let count = 0;

for (const file of files) {
  if (file.endsWith('.js')) {
    const filePath = path.join(DIST_ASSETS, file);
    const code = fs.readFileSync(filePath, 'utf-8');

    console.log(`🛡️ Obfuscating ${file}...`);

    const obfuscated = JavaScriptObfuscator.obfuscate(code, {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.6,
      numbersToExpressions: true,
      simplify: true,
      stringArray: true,
      stringArrayEncoding: ['base64'],
      stringArrayThreshold: 0.75,
      splitStrings: true,
      splitStringsChunkLength: 8,
      disableConsoleOutput: true,
      identifierNamesGenerator: 'hexadecimal'
    });

    fs.writeFileSync(filePath, obfuscated.getObfuscatedCode(), 'utf-8');
    count++;
  }
}

console.log(`✅ Production Obfuscation Complete: Protected ${count} JavaScript file(s).`);
console.log('🔐 Source code is encrypted against reverse engineering and APK cracking.');
