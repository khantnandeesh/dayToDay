import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import dotenv from 'dotenv';
import path from 'path';
import process from 'node:process';
import { languageServerManager } from '../backend/services/lsp/languageServerManager.js';
import { executeCode, SUPPORTED_LANGUAGES } from '../backend/services/execution/codeExecutionService.js';

// Load .env files from root and frontend
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function lspDevPlugin() {
  return {
    name: 'vite-plugin-lsp-dev',
    configureServer(server) {
      if (server.httpServer) {
        languageServerManager.attach(server.httpServer);
      }

      // Handle /api/code/run endpoint directly in dev server
      server.middlewares.use('/api/code/run', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ success: false, message: 'Method Not Allowed' }));
        }

        let bodyStr = '';
        req.on('data', (chunk) => {
          bodyStr += chunk;
        });

        req.on('end', async () => {
          try {
            const body = JSON.parse(bodyStr || '{}');
            const result = await executeCode({
              language: body.language || 'python',
              code: body.code,
              input: body.input,
            });

            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: result.success, data: result }));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, message: err.message }));
          }
        });
      });

      // Handle /api/code/languages endpoint directly in dev server
      server.middlewares.use('/api/code/languages', (req, res) => {
        const languages = Object.values(SUPPORTED_LANGUAGES).map((lang) => ({
          id: lang.id,
          name: lang.name,
          version: lang.version,
          compiler: lang.compiler,
          defaultCode: lang.defaultCode,
        }));
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, data: languages }));
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), lspDevPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});

