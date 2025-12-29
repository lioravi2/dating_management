#!/usr/bin/env node

/**
 * Kill Metro bundler processes running on port 8081
 * Cross-platform script that works on Windows, Mac, and Linux
 */

const { execSync } = require('child_process');
const os = require('os');
const path = require('path');

const PORT = 8081;
const platform = os.platform();

console.log(`[kill-metro] Checking for processes on port ${PORT}...`);

try {
  let pids = [];

  if (platform === 'win32') {
    // Windows: Use netstat to find processes
    try {
      const output = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf-8', stdio: 'pipe' });
      const lines = output.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const match = line.match(/\s+(\d+)\s*$/);
        if (match) {
          const pid = match[1];
          if (pid && !pids.includes(pid)) {
            pids.push(pid);
          }
        }
      }
    } catch (error) {
      // No processes found or netstat failed - that's okay
      if (error.status !== 1) {
        // Status 1 means no matches found, which is fine
        console.log(`[kill-metro] No processes found on port ${PORT}`);
        process.exit(0);
      }
    }

    // Kill processes on Windows
    for (const pid of pids) {
      try {
        console.log(`[kill-metro] Killing process ${pid}...`);
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`[kill-metro] ✓ Killed process ${pid}`);
      } catch (error) {
        console.log(`[kill-metro] ⚠ Could not kill process ${pid} (may have already exited)`);
      }
    }
  } else {
    // Mac/Linux: Use lsof to find processes
    try {
      const output = execSync(`lsof -ti:${PORT}`, { encoding: 'utf-8', stdio: 'pipe' });
      pids = output.trim().split('\n').filter(pid => pid.trim());
    } catch (error) {
      // No processes found - that's okay
      console.log(`[kill-metro] No processes found on port ${PORT}`);
      process.exit(0);
    }

    // Kill processes on Mac/Linux
    for (const pid of pids) {
      try {
        console.log(`[kill-metro] Killing process ${pid}...`);
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        console.log(`[kill-metro] ✓ Killed process ${pid}`);
      } catch (error) {
        console.log(`[kill-metro] ⚠ Could not kill process ${pid} (may have already exited)`);
      }
    }
  }

  if (pids.length === 0) {
    console.log(`[kill-metro] ✓ Port ${PORT} is already free`);
  } else {
    console.log(`[kill-metro] ✓ Cleaned up ${pids.length} process(es) on port ${PORT}`);
  }

  process.exit(0);
} catch (error) {
  console.error(`[kill-metro] Error: ${error.message}`);
  process.exit(1);
}



