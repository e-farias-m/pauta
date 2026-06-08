#!/usr/bin/env node
// build.js — Concatenates src/*.js modules into pauta.html
// Usage: node build.js

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_HEAD_LINES = 1759;
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

const original = readFileSync(join(__dirname, 'pauta.html'), 'utf8');
const lines = original.split('\n');
const htmlHead = lines.slice(0, HTML_HEAD_LINES).join('\n');
const htmlTail = lines.slice(-2).join('\n');

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

const output = htmlHead + '\n<script>\n' + jsBundle + htmlTail;
writeFileSync(join(__dirname, 'pauta.html'), output, 'utf8');
console.log(`Built pauta.html — ${modules.length} modules, ${jsBundle.split('\n').length} JS lines`);
