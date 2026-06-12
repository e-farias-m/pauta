#!/usr/bin/env node
// build.js — Concatenates src/*.js modules into pauta.html
// Usage: node build.js

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, 'src');

const modules = [
  'globals.js',
  'theory.js',
  'instruments.js',
  'notation.js',
  'rendering.js',
  'input.js',
  'education.js',
  'playback.js',
  'ui.js',
];

let original = readFileSync(join(__dirname, 'pauta.html'), 'utf8');

// Strip any previously injected #design-system blocks to avoid duplication
original = original.replace(/<style id="design-system">[\s\S]*?<\/style>\n*/g, '');

// Find the <script> tag position to split HTML head from JS bundle
const scriptIdx = original.indexOf('<script>');
if (scriptIdx === -1) { console.error('No <script> tag found in pauta.html'); process.exit(1); }
const htmlHead = original.slice(0, scriptIdx);
const htmlTail = '</script>\n</body>\n</html>';

// Inline design-system.css
const dsCssPath = join(srcDir, 'design-system.css');
const dsCss = existsSync(dsCssPath) ? readFileSync(dsCssPath, 'utf8') : '';
const cssBlock = dsCss ? `\n<style id="design-system">\n${dsCss}\n</style>\n` : '';

let jsBundle = '';
for (const mod of modules) {
  const modPath = join(srcDir, mod);
  if (!existsSync(modPath)) {
    console.error(`Missing module: ${modPath}`);
    process.exit(1);
  }
  const content = readFileSync(modPath, 'utf8');
  jsBundle += `\n// ─── Module: ${mod} ────────────────────────────────────\n`;
  jsBundle += content;
  jsBundle += '\n';
}

const output = htmlHead + cssBlock + '\n<script>\n' + jsBundle + htmlTail;
writeFileSync(join(__dirname, 'pauta.html'), output, 'utf8');
console.log(`Built pauta.html — ${modules.length} modules, ${jsBundle.split('\n').length} JS lines`);
