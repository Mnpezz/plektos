# Caching Strategy for Plektos

This document explains the caching strategy implemented to ensure users always get the latest version of the app without needing to hard refresh.

## Problem

Users had to hard refresh (Shift+F5) to see updates after new deployments because browsers were caching the `index.html` file.

## Solution

We've implemented a multi-layered caching strategy:

### 1. HTML Files (Never Cached)
- `index.html` and `404.html` are never cached
- Always fetched fresh from the server
- Contains cache-busting meta tags

### 2. Versioned Assets (Aggressively Cached)
- JavaScript and CSS files in `/assets/` with content hashes
- Cached for 1 year with `immutable` directive
- Safe to cache aggressively because content changes = new filename

### 3. Static Assets (Moderately Cached)
- Images, fonts, icons: cached for 30 days
- Manifest and config files: cached for 1 day

## Implementation

### Vite Configuration
The `vite.config.ts` has been updated to ensure all assets are versioned with content hashes:

```typescript
build: {
  rollupOptions: {
    output: {
      assetFileNames: 'assets/[name]-[hash][extname]',
      chunkFileNames: 'assets/[name]-[hash].js',
      entryFileNames: 'assets/[name]-[hash].js',
    },
  },
}
```

### HTML Meta Tags
Cache-busting meta tags have been added to `index.html`:

```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
```

### Build Process
The build process now adds build timestamps to help with debugging:

```bash
npm run build
```

This will:
1. Build the app with Vite
2. Add build timestamp meta tags
3. Copy index.html to 404.html

## Nginx Configuration

### Option 1: Complete Configuration
Use the provided `nginx.conf` file as a starting point for your nginx configuration.

### Option 2: Add Cache Headers
If you have an existing nginx configuration, add the cache header rules from `nginx-cache-headers.conf`.

### Key Nginx Rules

```nginx
# Never cache HTML files
location ~* \.(html)$ {
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    try_files $uri $uri/ /index.html;
}

# Aggressively cache versioned assets
location ~* /assets/.*\.(js|css)$ {
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    expires 1y;
    try_files $uri =404;
}
```

## Deployment Steps

1. **Build the app**: `npm run build`
2. **Update nginx configuration** with the provided cache headers
3. **Deploy the `dist/` folder** to your web server
4. **Reload nginx**: `sudo nginx -s reload`

## Verification

After deployment, you can verify the caching is working correctly:

### Check Response Headers
```bash
# HTML should have no-cache headers
curl -I https://your-domain.com/

# Assets should have long cache headers
curl -I https://your-domain.com/assets/index-[hash].js
```

### Browser DevTools
1. Open DevTools → Network tab
2. Reload the page
3. Check the response headers:
   - HTML files: `Cache-Control: no-cache, no-store, must-revalidate`
   - Asset files: `Cache-Control: public, max-age=31536000, immutable`

### Build Info
Check the HTML source for build timestamp meta tags to confirm you're getting the latest version:

```html
<meta name="build-time" content="2025-01-23T..." />
<meta name="build-timestamp" content="1737..." />
```

## Benefits

✅ **No more hard refreshes needed** - Users automatically get the latest version  
✅ **Fast loading** - Static assets are cached aggressively  
✅ **Reliable updates** - HTML is always fresh  
✅ **Better performance** - Optimal cache utilization  
✅ **Debug friendly** - Build timestamps help identify versions  

## Troubleshooting

### Users still seeing old version
1. Check nginx configuration is applied and reloaded
2. Verify HTML response headers show no-cache
3. Check if CDN or proxy is overriding cache headers

### Assets not loading
1. Verify asset paths in built HTML match nginx location rules
2. Check browser console for 404 errors
3. Ensure nginx has read permissions on dist folder

### Build info not showing
1. Verify `scripts/add-build-info.js` runs during build
2. Check build output for success messages
3. Ensure Node.js has write permissions to dist folder