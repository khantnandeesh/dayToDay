#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('🚀 Starting DayToDay development servers (Backend on :5000, Frontend on :3000)...');

let isShuttingDown = false;
let backendProcess = null;
let frontendProcess = null;

function startBackend() {
  if (isShuttingDown) return;

  backendProcess = spawn('node', ['backend/index.js'], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: '5000',
      NODE_ENV: 'development',
    },
    stdio: 'inherit',
  });

  backendProcess.on('error', (err) => {
    console.error('[backend] Failed to start:', err.message);
  });

  backendProcess.on('close', (code) => {
    if (!isShuttingDown && code !== 0) {
      console.warn(`[backend] Exited with code ${code}. Restarting in 2s...`);
      setTimeout(startBackend, 2000);
    }
  });
}

function startFrontend() {
  if (isShuttingDown) return;

  const localVite = path.join(rootDir, 'frontend', 'node_modules', '.bin', 'vite');
  const rootVite = path.join(rootDir, 'node_modules', '.bin', 'vite');
  const viteCmd = fs.existsSync(localVite) ? localVite : fs.existsSync(rootVite) ? rootVite : 'vite';

  frontendProcess = spawn(viteCmd, ['--host', '0.0.0.0', '--port', '3000'], {
    cwd: path.join(rootDir, 'frontend'),
    env: {
      ...process.env,
      PORT: '3000',
    },
    stdio: 'inherit',
  });

  frontendProcess.on('error', (err) => {
    console.error('[frontend] Failed to start:', err.message);
  });

  frontendProcess.on('close', (code) => {
    if (!isShuttingDown && code !== 0) {
      console.warn(`[frontend] Exited with code ${code}. Restarting in 2s...`);
      setTimeout(startFrontend, 2000);
    }
  });
}

startBackend();
startFrontend();

const cleanup = (code = 0) => {
  isShuttingDown = true;
  try {
    if (backendProcess) backendProcess.kill('SIGTERM');
  } catch {}
  try {
    if (frontendProcess) frontendProcess.kill('SIGTERM');
  } catch {}
  process.exit(code);
};

process.on('SIGINT', () => cleanup(0));
process.on('SIGTERM', () => cleanup(0));
