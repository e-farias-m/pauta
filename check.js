#!/usr/bin/env node
// check.js — Syntax-check all src/*.js modules + built pauta.html
// Usage: node check.js
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
let errors = 0;

// Check each module individually (as a function body to allow top-level constructs)
console.log('Checking modules...');
for (const f of readdirSync(join(__dirname, 'src')).filter(f => f.endsWith('.js'))) {
  const code = readFileSync(join(__dirname, 'src', f), 'utf8');
  try { new vm.Script(code, { filename: f }); console.log(`  ✓ ${f}`); }
    catch(e) {
      // globals.js starts an IIFE that closes in ui.js — expected individual failure
      if (f === 'globals.js' || f === 'ui.js') { console.log(`  ~ ${f} (IIFE span, expected)`); }
      else { console.error(`  ✗ ${f}: ${e.message.split('\n')[0]}`); errors++; }
    }
}

// Check built pauta.html script block
console.log('Checking built pauta.html...');
const html = readFileSync(join(__dirname, 'pauta.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('  ✗ No <script> block found'); errors++; }
else {
  try { new vm.Script(m[1], { filename: 'pauta.html' }); console.log('  ✓ pauta.html script block'); }
  catch(e) { console.error(`  ✗ pauta.html: ${e.message.split('\n')[0]}`); errors++; }
}

if (errors) { console.error(`\n${errors} error(s)`); process.exit(1); }
else console.log('\nAll checks passed ✓');
