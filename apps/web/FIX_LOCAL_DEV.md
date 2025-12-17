# Fix Local Development 404 Errors

If you're seeing 404 errors for static assets (CSS/JS files) in localhost:3000, follow these steps:

## Step 1: Stop the Dev Server
Press `Ctrl+C` in the terminal where `npm run dev` is running.

## Step 2: Clear the Build Cache
```powershell
cd apps/web
Remove-Item -Recurse -Force .next
```

Or on Mac/Linux:
```bash
cd apps/web
rm -rf .next
```

## Step 3: Clear Node Modules Cache (Optional but Recommended)
```powershell
cd apps/web
Remove-Item -Recurse -Force node_modules/.cache
```

## Step 4: Restart the Dev Server
```powershell
cd apps/web
npm run dev
```

## Step 5: Hard Refresh Browser
- **Windows/Linux**: `Ctrl + Shift + R` or `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

## If Issues Persist

### Check for Port Conflicts
```powershell
netstat -ano | findstr :3000
```

If another process is using port 3000, either:
- Kill that process
- Run Next.js on a different port: `npm run dev -- -p 3001`

### Clear Browser Cache
1. Open Chrome DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

### Reinstall Dependencies (Last Resort)
```powershell
cd apps/web
Remove-Item -Recurse -Force node_modules
npm install
npm run dev
```

## Common Causes
- Corrupted `.next` build cache
- Dev server not fully restarted
- Browser cache issues
- Port conflicts
- Stale build artifacts

