#!/usr/bin/env node
// build.js — Concatenates src/*.js modules and CSS into pauta.html
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
  'education/exercises.js',
  'education/session.js',
  'education/kit.js',
  'playback.js',
  'ui.js',
];

// Read the source template
const templatePath = join(srcDir, 'index.html');
if (!existsSync(templatePath)) {
  console.error(`Template not found: ${templatePath}`);
  process.exit(1);
}
let template = readFileSync(templatePath, 'utf8');

// Read and concatenate CSS files
const cssFiles = [
  join(srcDir, 'styles', 'main.css'),
  join(srcDir, 'design-system.css'),
];

let cssBundle = '';
for (const cssFile of cssFiles) {
  if (existsSync(cssFile)) {
    const content = readFileSync(cssFile, 'utf8');
    cssBundle += content + '\n';
  }
}

// Wrap CSS in style tag
const cssBlock = cssBundle ? `\n<style>\n${cssBundle}\n</style>\n` : '';

// Inject CSS
template = template.replace('<!-- CSS_INJECT -->', cssBlock);

// Concatenate JS modules
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

// Wrap JS in script tag
const jsBlock = `\n<script>\n${jsBundle}\n</script>\n`;

// Inject JS
template = template.replace('<!-- JS_INJECT -->', jsBlock);

// Write output
const outputPath = join(__dirname, 'pauta.html');
writeFileSync(outputPath, template, 'utf8');
console.log(`Built pauta.html — ${modules.length} modules, ${cssFiles.length} CSS files, ${jsBundle.split('\n').length} JS lines`);