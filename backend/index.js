import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import vaultRoutes from './routes/vaultRoutes.js';
import driveRoutes from './routes/driveRoutes.js';
import codeRoutes from './routes/codeRoutes.js';
import { languageServerManager } from './services/lsp/languageServerManager.js';
import AllowedOrigin from './models/AllowedOrigin.js';
import { checkEmailProviders } from './config/email.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  buildServer,
  mcpTransports,
  oauthMetadata,
  oauthRegister,
  oauthToken,
  oauthAuthorize,
  resolveUserId,
  getPublicBaseUrl,
  handleDirectHttpUpload,
} from './mcp/server.js';
import { handleStreamableMcp } from './mcp/streamable.js';

dotenv.config();

const app = express();

// ---------------------------------------------------------------------------
// Security & Body Parsers
// ---------------------------------------------------------------------------
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: false,
  })
);
app.use(mongoSanitize());
app.use(xss());
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ limit: '50mb', type: ['application/octet-stream', 'application/pdf', 'image/*'] }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Dynamic CORS Configuration
// ---------------------------------------------------------------------------
const getAllowedOrigins = async () => {
  const defaultOrigins = [
    'https://nandeesh.dev',
    'https://www.nandeesh.dev',
    'https://day-to-day-seven.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  try {
    const dbOrigins = await AllowedOrigin.find({});
    const urls = dbOrigins.map((o) => o.url);
    if (process.env.FRONTEND_URL) urls.push(process.env.FRONTEND_URL);
    return [...new Set([...urls, ...defaultOrigins])];
  } catch {
    const fallback = process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [];
    return [...new Set([...fallback, ...defaultOrigins])];
  }
};

const corsOptions = {
  origin: async function (origin, callback) {
    if (!origin) return callback(null, true);
    try {
      const allowedOrigins = await getAllowedOrigins();
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } catch (err) {
      callback(err);
    }
  },
  credentials: true,
};

// Permissive CORS for MCP & OAuth endpoints (consumed by Gemini, Claude, Cursor, AI agents, EventSource)
const mcpCors = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, Mcp-Session-Id, Last-Event-Id, X-Requested-With, Accept, Cache-Control'
  );
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Mcp-Session-Id, WWW-Authenticate, Content-Type'
  );
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
};

app.use((req, res, next) => {
  if (
    req.path.startsWith('/mcp') ||
    req.path.startsWith('/oauth') ||
    req.path.startsWith('/.well-known')
  ) {
    return mcpCors(req, res, next);
  }
  return cors(corsOptions)(req, res, next);
});

// ---------------------------------------------------------------------------
// Connect to Database
// ---------------------------------------------------------------------------
connectDB();

// ---------------------------------------------------------------------------
// Model Context Protocol (MCP) & OAuth Endpoints
// ---------------------------------------------------------------------------

// 1. Streamable HTTP MCP Endpoint
app.all('/mcp', handleStreamableMcp);

// 2. RFC 9728 OAuth 2.0 Protected Resource Metadata
app.get(
  ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/*'],
  (req, res) => {
    const base = getPublicBaseUrl(req);
    res.json({
      resource: `${base}/mcp`,
      authorization_servers: [base],
      scopes_supported: ['mcp'],
      bearer_methods_supported: ['header'],
    });
  }
);

// 3. RFC 8414 OAuth 2.0 Authorization Server Metadata & OpenID Configuration
app.get(
  [
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-authorization-server/*',
    '/.well-known/openid-configuration',
  ],
  oauthMetadata
);

// 4. OAuth 2.0 Core Endpoints
app.post('/oauth/register', oauthRegister);
app.post('/oauth/token', oauthToken);
app.get('/oauth/authorize', oauthAuthorize);
app.post('/oauth/authorize', oauthAuthorize);

// 5. MCP Server over SSE (Server-Sent Events)
app.get('/mcp/sse', async (req, res) => {
  let userId = null;
  try {
    userId = await resolveUserId(req);
  } catch {
    // Allows anonymous SSE stream establishment for preflight discovery;
    // authenticated POST /mcp/messages binds the real user.
  }

  const ctx = { userId };
  const transport = new SSEServerTransport('/mcp/messages', res);
  const server = buildServer(ctx);

  mcpTransports.set(transport.sessionId, { transport, server, ctx, userId: userId ? String(userId) : null });

  res.on('close', () => {
    mcpTransports.delete(transport.sessionId);
  });

  await server.connect(transport);
});

app.post('/mcp/messages', async (req, res) => {
  const sessionId = req.query.sessionId || req.headers['mcp-session-id'];
  const entry = mcpTransports.get(sessionId);

  if (!entry) {
    return res.status(404).json({
      success: false,
      message: 'Unknown or expired MCP session',
    });
  }

  let userId;
  try {
    userId = await resolveUserId(req);
  } catch {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // Bind the authenticated user to this connection
  entry.ctx.userId = userId;
  entry.userId = String(userId);

  await entry.transport.handlePostMessage(req, res);
});

// 6. Direct HTTP Binary / File Upload for MCP AI Environments & Python code interpreter
app.post(['/mcp/upload-file', '/mcp/upload', '/api/mcp/upload'], handleDirectHttpUpload);

// ---------------------------------------------------------------------------
// CORS Admin Interface (SSR)
// ---------------------------------------------------------------------------
app.get('/cors-admin', async (req, res) => {
  try {
    const origins = await AllowedOrigin.find({});
    const currentEnv = process.env.FRONTEND_URL || 'Not Set';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>CORS Manager - DayToDay</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-900 min-h-screen p-8 font-sans text-slate-100">
        <div class="max-w-2xl mx-auto bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden">
            <div class="bg-slate-950 p-6 text-white flex justify-between items-center border-b border-slate-700">
                <h1 class="text-xl font-bold flex items-center gap-2">🛡️ CORS Origin Manager</h1>
                <span class="text-xs bg-cyan-950 text-cyan-400 border border-cyan-800 px-3 py-1 rounded-full font-mono">DayToDay Admin</span>
            </div>
            
            <div class="p-6 space-y-6">
                <div class="bg-slate-900 border border-slate-700 p-4 rounded-lg">
                    <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Static Frontend Origin</div>
                    <code class="text-cyan-400 font-mono text-sm">${currentEnv}</code>
                </div>

                <div>
                    <h2 class="text-base font-semibold text-slate-200 mb-3">Allowed Dynamic Origins</h2>
                    <div class="space-y-2">
                        ${origins.length === 0 ? '<p class="text-slate-500 italic text-sm">No dynamic origins added yet.</p>' : ''}
                        ${origins.map((o) => `
                            <div class="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-700">
                                <div class="font-mono text-sm text-slate-300">${o.url}</div>
                                <form action="/cors-admin/delete" method="POST" onsubmit="return confirm('Remove origin ${o.url}?');">
                                    <input type="hidden" name="id" value="${o._id}">
                                    <button type="submit" class="text-red-400 hover:text-red-300 hover:bg-red-950/50 p-1.5 rounded transition">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-1 1-1h6c0 0 1 0 1 1v2"/></svg>
                                    </button>
                                </form>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <form action="/cors-admin/add" method="POST" class="mt-6 border-t border-slate-700 pt-6">
                    <label class="block text-sm font-medium text-slate-300 mb-2">Add New Allowed Origin</label>
                    <div class="flex gap-2">
                        <input type="url" name="url" placeholder="https://my-app.vercel.app" required 
                            class="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-sm font-mono">
                        <button type="submit" class="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-5 py-2 rounded-lg transition font-semibold text-sm">
                            Add Origin
                        </button>
                    </div>
                    <p class="text-xs text-slate-500 mt-2">Must include full protocol (e.g. https://)</p>
                </form>
            </div>
        </div>
    </body>
    </html>
    `;
    res.send(html);
  } catch (error) {
    res.status(500).send('Error loading admin: ' + error.message);
  }
});

app.post('/cors-admin/add', async (req, res) => {
  try {
    let { url } = req.body;
    if (url.endsWith('/')) url = url.slice(0, -1);
    await AllowedOrigin.create({ url });
    res.redirect('/cors-admin');
  } catch (error) {
    res.status(400).send('Failed to add origin: ' + error.message);
  }
});

app.post('/cors-admin/delete', async (req, res) => {
  try {
    await AllowedOrigin.findByIdAndDelete(req.body.id);
    res.redirect('/cors-admin');
  } catch (error) {
    res.status(400).send('Failed to delete');
  }
});

// ---------------------------------------------------------------------------
// Standard REST API Routes
// ---------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/code', codeRoutes);

// Health check
app.get('/health', async (req, res) => {
  const emailStatus = await checkEmailProviders();
  res.status(200).json({
    success: true,
    message: 'DayToDay Server is healthy and running',
    email: emailStatus,
    mcp: {
      streamableEndpoint: '/mcp',
      sseEndpoint: '/mcp/sse',
      protectedResourceMetadata: '/.well-known/oauth-protected-resource',
      authServerMetadata: '/.well-known/oauth-authorization-server',
    },
    lsp: {
      python: '/lsp/python',
    },
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server error',
  });
});

const PORT = process.env.PORT || 3000;

// Create HTTP server to support both Express HTTP routes and WebSocket upgrades for LSP
const server = http.createServer(app);

// Attach Language Server Manager WebSocket server
languageServerManager.attach(server);

server.listen(PORT, () => {
  console.log(`\n🚀 DayToDay Server running on port ${PORT}`);
  console.log(`📡 Backend URL: ${process.env.BACKEND_URL || `http://localhost:${PORT}`}`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'Not set'}`);
  console.log(`🐍 Python LSP WebSocket: ws://localhost:${PORT}/lsp/python`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});
