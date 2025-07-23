#!/usr/bin/env node

/**
 * Add build timestamp and version info to index.html for cache debugging
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const distPath = join(process.cwd(), 'dist');
const indexPath = join(distPath, 'index.html');

try {
  // Read the built index.html
  let html = readFileSync(indexPath, 'utf8');
  
  // Get build info
  const buildTime = new Date().toISOString();
  const buildTimestamp = Date.now();
  
  // Add build info as meta tags and HTML comment
  const buildInfo = `
    <!-- Build Info -->
    <meta name="build-time" content="${buildTime}" />
    <meta name="build-timestamp" content="${buildTimestamp}" />
    <!-- Built at: ${buildTime} (${buildTimestamp}) -->`;
  
  // Insert build info before the closing </head> tag
  html = html.replace('</head>', `${buildInfo}\n  </head>`);
  
  // Write the updated HTML
  writeFileSync(indexPath, html, 'utf8');
  
  console.log(`✅ Added build info to index.html`);
  console.log(`   Build time: ${buildTime}`);
  console.log(`   Build timestamp: ${buildTimestamp}`);
  
  // Copy index.html to 404.html with build info
  const notFoundPath = join(distPath, '404.html');
  try {
    writeFileSync(notFoundPath, html, 'utf8');
    console.log(`✅ Created 404.html with build info`);
  } catch (err) {
    console.error(`❌ Error creating 404.html:`, err.message);
  }
  
} catch (error) {
  console.error('❌ Error adding build info:', error.message);
  process.exit(1);
}