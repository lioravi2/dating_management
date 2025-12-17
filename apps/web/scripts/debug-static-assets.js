const fs = require('fs');
const path = require('path');

const SERVER_ENDPOINT = 'http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0';

function log(hypothesisId, location, message, data) {
  const payload = {
    sessionId: 'debug-session',
    runId: 'run1',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now()
  };
  
  fetch(SERVER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

// #region agent log
log('A', 'debug-static-assets.js:18', 'Starting static assets debug check', {});
// #endregion

const webDir = path.join(__dirname, '..');
const nextDir = path.join(webDir, '.next');

// Hypothesis A: Check if .next directory exists
// #region agent log
log('A', 'debug-static-assets.js:25', 'Checking if .next directory exists', { path: nextDir, exists: fs.existsSync(nextDir) });
// #endregion

if (fs.existsSync(nextDir)) {
  // Hypothesis A: Check static directory structure
  const staticDir = path.join(nextDir, 'static');
  const cssDir = path.join(staticDir, 'css');
  const chunksDir = path.join(staticDir, 'chunks');
  
  // #region agent log
  log('A', 'debug-static-assets.js:33', 'Checking static directory structure', {
    staticDirExists: fs.existsSync(staticDir),
    cssDirExists: fs.existsSync(cssDir),
    chunksDirExists: fs.existsSync(chunksDir)
  });
  // #endregion
  
  // Hypothesis A: List files in static/css
  if (fs.existsSync(cssDir)) {
    const cssFiles = fs.readdirSync(cssDir);
    // #region agent log
    log('A', 'debug-static-assets.js:42', 'CSS files found', { count: cssFiles.length, files: cssFiles.slice(0, 5) });
    // #endregion
  } else {
    // #region agent log
    log('A', 'debug-static-assets.js:46', 'CSS directory missing', {});
    // #endregion
  }
  
  // Hypothesis A: List files in static/chunks
  if (fs.existsSync(chunksDir)) {
    const chunkFiles = fs.readdirSync(chunksDir);
    // #region agent log
    log('A', 'debug-static-assets.js:53', 'Chunk files found', { count: chunkFiles.length, files: chunkFiles.slice(0, 10) });
    // #endregion
  } else {
    // #region agent log
    log('A', 'debug-static-assets.js:57', 'Chunks directory missing', {});
    // #endregion
  }
  
  // Hypothesis A: Check server directory
  const serverDir = path.join(nextDir, 'server');
  // #region agent log
  log('A', 'debug-static-assets.js:63', 'Server directory check', { exists: fs.existsSync(serverDir) });
  // #endregion
} else {
  // #region agent log
  log('A', 'debug-static-assets.js:67', '.next directory does not exist', {});
  // #endregion
}

// Hypothesis B: Check if dev server process is running
const http = require('http');

function checkDevServer(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      // #region agent log
      log('B', 'debug-static-assets.js:77', 'Dev server response', { port, statusCode: res.statusCode, headers: Object.keys(res.headers) });
      // #endregion
      resolve({ running: true, port, statusCode: res.statusCode });
    });
    
    req.on('error', (err) => {
      // #region agent log
      log('B', 'debug-static-assets.js:83', 'Dev server check failed', { port, error: err.message });
      // #endregion
      resolve({ running: false, port, error: err.message });
    });
    
    req.setTimeout(2000, () => {
      req.destroy();
      // #region agent log
      log('B', 'debug-static-assets.js:90', 'Dev server check timeout', { port });
      // #endregion
      resolve({ running: false, port, error: 'timeout' });
    });
  });
}

// Check common ports
Promise.all([checkDevServer(3000), checkDevServer(3001)]).then((results) => {
  // #region agent log
  log('B', 'debug-static-assets.js:97', 'All port checks complete', { results });
  // #endregion
});

// Hypothesis C: Check file permissions
if (fs.existsSync(nextDir)) {
  try {
    fs.accessSync(nextDir, fs.constants.W_OK);
    // #region agent log
    log('C', 'debug-static-assets.js:105', 'Directory is writable', { path: nextDir });
    // #endregion
  } catch (err) {
    // #region agent log
    log('C', 'debug-static-assets.js:109', 'Directory not writable', { path: nextDir, error: err.message });
    // #endregion
  }
}

// Hypothesis D: Check package.json scripts
const packageJson = JSON.parse(fs.readFileSync(path.join(webDir, 'package.json'), 'utf8'));
// #region agent log
log('D', 'debug-static-assets.js:116', 'Package.json scripts', { devScript: packageJson.scripts.dev });
// #endregion

// Hypothesis E: Check Next.js version
// #region agent log
log('E', 'debug-static-assets.js:120', 'Next.js version check', { nextVersion: packageJson.dependencies.next });
// #endregion

