#!/usr/bin/env node

/**
 * Verify caching headers are working correctly
 * Usage: node scripts/verify-caching.js [URL]
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const url = process.argv[2] || 'http://localhost';

console.log(`🔍 Verifying caching configuration for: ${url}`);
console.log('');

// Check if we have a built version to compare
try {
  const indexPath = join(process.cwd(), 'dist', 'index.html');
  const html = readFileSync(indexPath, 'utf8');
  
  // Extract build info
  const buildTimeMatch = html.match(/name="build-time" content="([^"]+)"/);
  const buildTimestampMatch = html.match(/name="build-timestamp" content="([^"]+)"/);
  
  if (buildTimeMatch && buildTimestampMatch) {
    console.log(`📦 Local build info:`);
    console.log(`   Build time: ${buildTimeMatch[1]}`);
    console.log(`   Build timestamp: ${buildTimestampMatch[1]}`);
    console.log('');
  }
  
  // Extract asset filenames
  const jsMatch = html.match(/src="\/assets\/(index-[^"]+\.js)"/);
  const cssMatch = html.match(/href="\/assets\/(index-[^"]+\.css)"/);
  
  if (jsMatch || cssMatch) {
    console.log(`📁 Asset files to test:`);
    if (jsMatch) console.log(`   JS: /assets/${jsMatch[1]}`);
    if (cssMatch) console.log(`   CSS: /assets/${cssMatch[1]}`);
    console.log('');
  }
  
} catch (error) {
  console.log(`⚠️  Could not read local build files. Run 'npm run build' first.`);
  console.log('');
}

console.log(`🧪 Manual testing commands:`);
console.log('');
console.log(`1. Test HTML caching (should show no-cache headers):`);
console.log(`   curl -I ${url}/`);
console.log('');
console.log(`2. Test asset caching (should show long cache headers):`);
console.log(`   curl -I ${url}/assets/index-[hash].js`);
console.log(`   curl -I ${url}/assets/index-[hash].css`);
console.log('');
console.log(`3. Expected headers:`);
console.log(`   HTML files: Cache-Control: no-cache, no-store, must-revalidate`);
console.log(`   Asset files: Cache-Control: public, max-age=31536000, immutable`);
console.log('');
console.log(`4. Browser testing:`);
console.log(`   - Open DevTools → Network tab`);
console.log(`   - Visit ${url}/`);
console.log(`   - Check response headers for index.html and asset files`);
console.log(`   - Look for build timestamp in HTML source`);
console.log('');
console.log(`💡 If users still see old versions:`);
console.log(`   - Verify nginx config is applied and reloaded`);
console.log(`   - Check if CDN/proxy is overriding headers`);
console.log(`   - Ensure HTML response shows no-cache headers`);