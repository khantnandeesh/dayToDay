import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';

/**
 * Extensible Language Server Configuration Registry
 * Allows easy addition of other languages (such as Java, TypeScript, Go) in the future.
 */
export const languageConfigs = {
  python: {
    id: 'python',
    name: 'Python',
    fileExtension: '.py',
    defaultFileUri: 'file:///workspace/main.py',
    rootUri: 'file:///workspace',
    resolveExecutable: () => {
      // 1. Direct path to node_modules/pyright/dist/pyright-langserver.js (most reliable across OS)
      const distJs = path.resolve(process.cwd(), 'node_modules/pyright/dist/pyright-langserver.js');
      if (fs.existsSync(distJs)) {
        return { command: process.execPath, args: [distJs, '--stdio'] };
      }

      // 2. Relative to backend directory if running from backend
      const parentDistJs = path.resolve(process.cwd(), '../node_modules/pyright/dist/pyright-langserver.js');
      if (fs.existsSync(parentDistJs)) {
        return { command: process.execPath, args: [parentDistJs, '--stdio'] };
      }

      // 3. node_modules/.bin/pyright-langserver
      const binPath = path.resolve(process.cwd(), 'node_modules/.bin/pyright-langserver');
      if (fs.existsSync(binPath)) {
        return { command: binPath, args: ['--stdio'] };
      }

      const parentBinPath = path.resolve(process.cwd(), '../node_modules/.bin/pyright-langserver');
      if (fs.existsSync(parentBinPath)) {
        return { command: parentBinPath, args: ['--stdio'] };
      }

      // Fallback: spawn npx or system binary
      return { command: 'npx', args: ['pyright-langserver', '--stdio'] };
    },
  },
  // Future language configurations can be added here (e.g. java, rust, cpp)
};

/**
 * Language Server Manager
 * Manages WebSocket LSP client sessions and bridges them with Language Server processes over stdio.
 */
export class LanguageServerManager {
  constructor() {
    this.sessions = new Map();
    this.wss = null;
  }

  /**
   * Spawns a language server process for the specified language
   */
  spawnServerProcess(languageId) {
    const config = languageConfigs[languageId];
    if (!config) {
      throw new Error(`Unsupported language for LSP: ${languageId}`);
    }

    const { command, args } = config.resolveExecutable();
    const proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      },
    });

    return proc;
  }

  /**
   * Handles a new WebSocket connection for LSP
   */
  handleConnection(ws, languageId = 'python') {
    const config = languageConfigs[languageId] || languageConfigs.python;
    const sessionId = `lsp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    let proc = null;
    let stdoutBuffer = Buffer.alloc(0);
    let isAlive = true;

    try {
      proc = this.spawnServerProcess(config.id);
    } catch (err) {
      console.error(`[LSP] Failed to spawn language server for ${languageId}:`, err);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            method: 'window/showMessage',
            params: {
              type: 1, // Error
              message: `Failed to start ${config.name} language server: ${err.message}`,
            },
          })
        );
        ws.close(1011, 'Language server start failed');
      }
      return;
    }

    const session = {
      id: sessionId,
      ws,
      proc,
      languageId: config.id,
      createdAt: new Date(),
    };

    this.sessions.set(sessionId, session);

    // Frame and forward messages from Language Server Process (stdout) to WebSocket
    proc.stdout.on('data', (chunk) => {
      stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);

      while (true) {
        const headerEnd = stdoutBuffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) break;

        const headerStr = stdoutBuffer.slice(0, headerEnd).toString('utf8');
        const match = headerStr.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          // Discard invalid header bytes up to next potential header
          stdoutBuffer = stdoutBuffer.slice(headerEnd + 4);
          continue;
        }

        const contentLength = parseInt(match[1], 10);
        const bodyStart = headerEnd + 4;

        if (stdoutBuffer.length < bodyStart + contentLength) {
          // Wait for remaining body data
          break;
        }

        const bodyBuf = stdoutBuffer.slice(bodyStart, bodyStart + contentLength);
        stdoutBuffer = stdoutBuffer.slice(bodyStart + contentLength);

        const bodyStr = bodyBuf.toString('utf8');

        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(bodyStr);
          } catch (sendErr) {
            console.error('[LSP] WebSocket send error:', sendErr.message);
          }
        }
      }
    });

    proc.stderr.on('data', (data) => {
      const errStr = data.toString('utf8');
      // Only log critical errors to avoid noisy output
      if (errStr.toLowerCase().includes('error') || errStr.toLowerCase().includes('fatal')) {
        console.warn(`[LSP ${config.name} stderr]:`, errStr.trim());
      }
    });

    proc.on('error', (err) => {
      console.error(`[LSP] Process error for ${sessionId}:`, err);
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(
            JSON.stringify({
              jsonrpc: '2.0',
              method: 'window/showMessage',
              params: {
                type: 1,
                message: `${config.name} language server encountered an error.`,
              },
            })
          );
        } catch {
          // Ignore
        }
      }
    });

    proc.on('exit', (code, signal) => {
      if (this.sessions.has(sessionId)) {
        this.sessions.delete(sessionId);
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, `Language server exited with code ${code || signal}`);
      }
    });

    // Handle messages from Client WebSocket and forward to Language Server Process (stdin)
    ws.on('message', (message) => {
      if (!proc || proc.killed || !proc.stdin.writable) return;

      try {
        let text = typeof message === 'string' ? message : message.toString('utf8');
        // If message is JSON-RPC payload, ensure stdio Content-Length header is attached
        const byteLen = Buffer.byteLength(text, 'utf8');
        const framed = `Content-Length: ${byteLen}\r\n\r\n${text}`;
        proc.stdin.write(framed);
      } catch (err) {
        console.error('[LSP] Error forwarding message to language server:', err);
      }
    });

    // Handle WebSocket close & error
    const cleanup = () => {
      if (this.sessions.has(sessionId)) {
        this.sessions.delete(sessionId);
      }
      if (proc && !proc.killed) {
        try {
          proc.kill('SIGTERM');
          // Force kill after timeout if still running
          setTimeout(() => {
            if (proc && !proc.killed) {
              proc.kill('SIGKILL');
            }
          }, 3000);
        } catch {
          // Ignore cleanup errors
        }
      }
    };

    ws.on('close', cleanup);
    ws.on('error', (err) => {
      console.error(`[LSP] WebSocket error in session ${sessionId}:`, err.message);
      cleanup();
    });

    // Heartbeat setup
    ws.on('pong', () => {
      isAlive = true;
    });
  }

  /**
   * Attaches WebSocket server to an existing HTTP/HTTPS server instance
   */
  attach(server) {
    this.wss = new WebSocketServer({ noServer: true });

    // Handle HTTP Upgrade requests
    server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const pathname = url.pathname;

      // Match /lsp, /lsp/:language, /api/lsp, /api/lsp/:language
      const lspMatch = pathname.match(/^\/(?:api\/)?lsp(?:\/([a-zA-Z0-9_-]+))?\/?$/);

      if (lspMatch) {
        const queryLang = url.searchParams.get('language');
        const pathLang = lspMatch[1];
        const languageId = (pathLang || queryLang || 'python').toLowerCase();

        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.handleConnection(ws, languageId);
        });
      }
    });

    // Periodic heartbeat check to prune dead connections
    const interval = setInterval(() => {
      if (!this.wss) return;
      for (const [sessionId, session] of this.sessions.entries()) {
        const ws = session.ws;
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          session.proc?.kill('SIGTERM');
          this.sessions.delete(sessionId);
        }
      }
    }, 30000);

    server.on('close', () => {
      clearInterval(interval);
      this.shutdown();
    });

    return this.wss;
  }

  /**
   * Graceful shutdown of all active sessions
   */
  shutdown() {
    for (const [sessionId, session] of this.sessions.entries()) {
      try {
        if (session.proc && !session.proc.killed) {
          session.proc.kill('SIGKILL');
        }
        if (session.ws && session.ws.readyState === WebSocket.OPEN) {
          session.ws.close(1001, 'Server shutting down');
        }
      } catch {
        // Ignore
      }
    }
    this.sessions.clear();
  }
}

export const languageServerManager = new LanguageServerManager();
export default languageServerManager;
