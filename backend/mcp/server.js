import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Session from '../models/Session.js';
import McpOAuthClient from '../models/McpOAuthClient.js';
import DriveFile from '../models/DriveFile.js';
import DriveFolder from '../models/DriveFolder.js';
import VaultSettings from '../models/VaultSettings.js';
import VaultItem from '../models/VaultItem.js';

// Holds active SSE transports keyed by MCP sessionId so the POST
// /mcp/messages endpoint can route client messages to the right server.
export const mcpTransports = new Map();

// Helper to determine the public base URL
export function getPublicBaseUrl(req) {
  if (process.env.MCP_PUBLIC_URL) {
    return process.env.MCP_PUBLIC_URL.replace(/\/$/, '');
  }
  const proto = req.headers?.['x-forwarded-proto'] || (req.connection?.encrypted ? 'https' : 'https');
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host || 'localhost:3000';
  return `${proto}://${host}`.replace(/\/$/, '');
}

// Lazy S3 / Cloudflare R2 Client setup
let r2Client = null;
function getR2Client() {
  if (!r2Client && process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID) {
    r2Client = new S3Client({
      region: process.env.R2_REGION || 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return r2Client;
}

const BUCKET_NAME = process.env.R2_BUCKET || 'drivealike';
const QUOTA_LIMIT = 5 * 1024 * 1024 * 1024; // 5 GB

const getUserStorageUsage = async (userId) => {
  const files = await DriveFile.find({ user: userId, isTrash: false });
  return files.reduce((acc, file) => acc + (file.size || 0), 0);
};

// ---------------------------------------------------------------------------
// MCP authentication
// ---------------------------------------------------------------------------
export async function authenticateMcpRequest(req, res, next) {
  let token =
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer')
      ? req.headers.authorization.split(' ')[1]
      : null) ||
    req.query.token ||
    req.cookies?.token;

  if (!token) {
    const base = getPublicBaseUrl(req);
    res.setHeader(
      'WWW-Authenticate',
      `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource", scope="mcp"`
    );
    return res
      .status(401)
      .json({ success: false, message: 'Unauthorized: missing token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let user;
    if (decoded.mcp) {
      // OAuth-issued access token (Gemini / Claude / Cursor / custom connected apps).
      user = await User.findById(decoded.id).select(
        '-password -twoFactorCode -twoFactorCodeExpires'
      );
    } else {
      // Enforce an active, non-expired session.
      const session = await Session.findOne({
        token,
        userId: decoded.id,
        isActive: true,
      });
      if (!session || !session.isValid()) {
        return res
          .status(401)
          .json({ success: false, message: 'Session expired or invalid' });
      }
      user = await User.findById(decoded.id).select(
        '-password -twoFactorCode -twoFactorCodeExpires'
      );
    }

    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ success: false, message: 'User not found or inactive' });
    }

    // Capture identity for the lifetime of this request/connection.
    req.user = user;
    req.userId = user._id;
    req.token = token;
    next();
  } catch (err) {
    const base = getPublicBaseUrl(req);
    res.setHeader(
      'WWW-Authenticate',
      `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource", scope="mcp"`
    );
    return res
      .status(401)
      .json({ success: false, message: 'Unauthorized: invalid token' });
  }
}

// Resolve the authenticated user id from a request (Bearer header / cookie / ?token).
export async function resolveUserId(req) {
  let token =
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer')
      ? req.headers.authorization.split(' ')[1]
      : null) ||
    req.query.token ||
    req.cookies?.token;

  if (!token) throw new Error('missing_token');

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  let user;
  if (decoded.mcp) {
    user = await User.findById(decoded.id).select(
      '-password -twoFactorCode -twoFactorCodeExpires'
    );
  } else {
    const session = await Session.findOne({
      token,
      userId: decoded.id,
      isActive: true,
    });
    if (!session || !session.isValid()) throw new Error('bad_session');
    user = await User.findById(decoded.id).select(
      '-password -twoFactorCode -twoFactorCodeExpires'
    );
  }

  if (!user || !user.isActive) throw new Error('no_user');
  return user._id;
}

// ---------------------------------------------------------------------------
// OAuth 2.0 (RFC 8414 & RFC 7591)
// ---------------------------------------------------------------------------
export function oauthMetadata(req, res) {
  const base = getPublicBaseUrl(req);
  res.json({
    issuer: base,
    authorization_endpoint: base + '/oauth/authorize',
    token_endpoint: base + '/oauth/token',
    registration_endpoint: base + '/oauth/register',
    grant_types_supported: ['authorization_code', 'client_credentials'],
    token_endpoint_auth_methods_supported: [
      'client_secret_basic',
      'client_secret_post',
      'none',
    ],
    response_types_supported: ['code'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['mcp'],
  });
}

function configuredRedirectUris() {
  return (process.env.MCP_ALLOWED_REDIRECT_URIS || '')
    .split(',')
    .map((uri) => uri.trim())
    .filter(Boolean);
}

function isValidRedirectUri(uri) {
  try {
    const parsed = new URL(uri);
    if (parsed.hash) return false;
    if (parsed.protocol === 'https:') return true;
    return (
      parsed.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function getStaticOAuthClient(clientId) {
  if (!process.env.MCP_CLIENT_ID || clientId !== process.env.MCP_CLIENT_ID) {
    return null;
  }

  return {
    clientId: process.env.MCP_CLIENT_ID,
    static: true,
    redirectUris: configuredRedirectUris(),
    grantTypes: ['authorization_code', 'client_credentials'],
    responseTypes: ['code'],
    tokenEndpointAuthMethod: 'client_secret_post',
  };
}

async function findOAuthClient(clientId) {
  return getStaticOAuthClient(clientId) || McpOAuthClient.findOne({ clientId });
}

function getClientCredentials(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator < 0) return {};
    return {
      clientId: decoded.slice(0, separator),
      clientSecret: decoded.slice(separator + 1),
    };
  }

  return {
    clientId: req.body?.client_id,
    clientSecret: req.body?.client_secret,
  };
}

async function authenticateOAuthClient(req) {
  const { clientId, clientSecret } = getClientCredentials(req);
  if (!clientId) return null;

  const staticClient = getStaticOAuthClient(clientId);
  if (staticClient && clientSecret === process.env.MCP_CLIENT_SECRET) {
    return staticClient;
  }

  const client = await McpOAuthClient.findOne({ clientId }).select('+clientSecretHash');
  if (!client) return null;
  if (client.tokenEndpointAuthMethod === 'none') return client;
  if (!clientSecret || !(await bcrypt.compare(clientSecret, client.clientSecretHash))) {
    return null;
  }

  return client;
}

// OAuth 2.0 Dynamic Client Registration (RFC 7591).
export async function oauthRegister(req, res) {
  const body = req.body || {};
  const redirectUris = body.redirect_uris;
  const grantTypes = body.grant_types || ['authorization_code'];
  const responseTypes = body.response_types || ['code'];
  const tokenEndpointAuthMethod = body.token_endpoint_auth_method || 'client_secret_basic';
  const requestedScopes = body.scope
    ? String(body.scope).split(/\s+/).filter(Boolean)
    : ['mcp'];

  if (
    !Array.isArray(redirectUris) ||
    redirectUris.length === 0 ||
    redirectUris.some((uri) => typeof uri !== 'string' || !isValidRedirectUri(uri))
  ) {
    return res.status(400).json({
      error: 'invalid_redirect_uris',
      error_description: 'redirect_uris must contain absolute HTTPS URLs (or localhost HTTP URLs).',
    });
  }

  if (!Array.isArray(grantTypes) || grantTypes.some((grantType) => grantType !== 'authorization_code')) {
    return res.status(400).json({
      error: 'invalid_client_metadata',
      error_description: 'Only the authorization_code grant is supported for dynamically registered clients.',
    });
  }

  if (!Array.isArray(responseTypes) || responseTypes.length !== 1 || responseTypes[0] !== 'code') {
    return res.status(400).json({
      error: 'invalid_client_metadata',
      error_description: 'Only the code response type is supported.',
    });
  }

  if (!['client_secret_basic', 'client_secret_post', 'none'].includes(tokenEndpointAuthMethod)) {
    return res.status(400).json({
      error: 'invalid_client_metadata',
      error_description: 'Use client_secret_basic, client_secret_post, or none.',
    });
  }

  if (requestedScopes.some((scope) => scope !== 'mcp')) {
    return res.status(400).json({
      error: 'invalid_client_metadata',
      error_description: 'Only the mcp scope is supported.',
    });
  }

  const clientId = 'daytoday_' + crypto.randomBytes(18).toString('base64url');
  const clientSecret = tokenEndpointAuthMethod === 'none'
    ? null
    : crypto.randomBytes(32).toString('base64url');
  const clientName = String(body.client_name || 'MCP Client').slice(0, 200);
  const clientIdIssuedAt = Math.floor(Date.now() / 1000);

  await McpOAuthClient.create({
    clientId,
    clientSecretHash: await bcrypt.hash(clientSecret || crypto.randomBytes(32).toString('base64url'), 12),
    clientName,
    redirectUris,
    grantTypes: ['authorization_code'],
    responseTypes: ['code'],
    tokenEndpointAuthMethod,
  });

  const registration = {
    client_id: clientId,
    client_id_issued_at: clientIdIssuedAt,
    client_secret_expires_at: 0,
    client_name: clientName,
    redirect_uris: redirectUris,
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: tokenEndpointAuthMethod,
    scope: 'mcp',
  };
  if (clientSecret) registration.client_secret = clientSecret;
  return res.status(201).json(registration);
}

// Authorization endpoint (Authorization Code flow with PKCE).
function renderLoginForm(params, errorMessage = null, userEmail = '') {
  const cleanParams = { ...params };
  delete cleanParams.error;
  delete cleanParams.email;
  delete cleanParams.password;

  const hidden = Object.entries(cleanParams)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${String(v).replace(/"/g, '&quot;')}">`)
    .join('');

  const errorHtml = errorMessage
    ? `<div style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:16px;line-height:1.4;">${errorMessage}</div>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize DayToDay MCP</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      min-height: 100vh;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 16px;
    }
    .card {
      background: #1e293b;
      padding: 32px 28px;
      border-radius: 14px;
      border: 1px solid #334155;
      box-shadow: 0 12px 40px rgba(0,0,0,.5);
      width: 100%;
      max-width: 380px;
    }
    .brand-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 9999px;
      color: #38bdf8;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    h1 { font-size: 20px; margin: 0 0 8px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px; }
    p { color: #94a3b8; font-size: 13.5px; margin: 0 0 20px; line-height: 1.5; }
    label { display: block; font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; }
    input[type="email"], input[type="password"] {
      width: 100%;
      padding: 12px 14px;
      margin-bottom: 16px;
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid #334155;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    input:focus {
      outline: none;
      border-color: #38bdf8;
      box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
    }
    button {
      width: 100%;
      padding: 13px;
      background: #38bdf8;
      color: #0f172a;
      border: 0;
      border-radius: 8px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.15s ease-in-out;
      margin-top: 4px;
    }
    button:hover { background: #7dd3fc; }
    button:active { transform: scale(0.99); }
    .muted {
      font-size: 12px;
      color: #64748b;
      margin-top: 20px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand-badge">⚡ MCP Connected App</div>
    <h1>Connect DayToDay</h1>
    <p>Sign in to grant your AI client (Claude, Gemini, Cursor) secure access to your DayToDay vault & drive.</p>
    ${errorHtml}
    <form method="post" id="authForm">
      ${hidden}
      <div>
        <label for="email">Account Email</label>
        <input id="email" name="email" type="email" placeholder="name@example.com" value="${String(userEmail || '').replace(/"/g, '&quot;')}" autocomplete="username" required autofocus>
      </div>
      <div>
        <label for="password">Password</label>
        <input id="password" name="password" type="password" placeholder="Enter your password" autocomplete="current-password" required>
      </div>
      <button type="submit" id="submitBtn">Authorize Connection &rarr;</button>
    </form>
    <div class="muted">DayToDay Cloud &bull; Model Context Protocol</div>
  </div>
  <script>
    document.getElementById('authForm').addEventListener('submit', function() {
      var btn = document.getElementById('submitBtn');
      btn.disabled = true;
      btn.textContent = 'Authorizing & Redirecting...';
      btn.style.opacity = '0.7';
    });
  </script>
</body>
</html>`;
}

export async function oauthAuthorize(req, res) {
  const q = req.method === 'POST' ? { ...req.query, ...req.body } : req.query;
  const {
    response_type,
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    scope,
  } = q;

  if (response_type !== 'code' || !clientId) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  const client = await findOAuthClient(clientId);
  if (!client) return res.status(400).json({ error: 'invalid_client' });
  if (!redirectUri || !client.redirectUris?.includes(redirectUri)) {
    return res.status(400).json({ error: 'invalid_redirect_uri' });
  }
  if (scope && String(scope).split(/\s+/).some((value) => value !== 'mcp')) {
    return res.status(400).json({ error: 'invalid_scope' });
  }
  if (codeChallenge && codeChallengeMethod !== 'S256') {
    return res.status(400).json({ error: 'invalid_request' });
  }
  if (!client.static && (!codeChallenge || codeChallengeMethod !== 'S256')) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'PKCE with S256 is required.',
    });
  }

  if (req.cookies?.token) {
    try {
      const d = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
      const sess = await Session.findOne({
        token: req.cookies.token,
        userId: d.id,
        isActive: true,
      });
      if (sess && sess.isValid()) {
        return finishAuthorize(res, d.id, {
          clientId,
          redirectUri,
          state,
          codeChallenge,
        });
      }
    } catch {
      /* fall through to login form */
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'text/html');
    return res.send(renderLoginForm(q));
  }

  const rawEmail = (req.body?.email || '').trim().toLowerCase();
  const password = req.body?.password || '';

  if (!rawEmail || !password) {
    res.status(400).setHeader('Content-Type', 'text/html');
    return res.send(renderLoginForm(q, 'Please provide both email and password.', rawEmail));
  }

  const user = await User.findOne({ email: rawEmail }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    res.status(401).setHeader('Content-Type', 'text/html');
    return res.send(renderLoginForm(q, 'Invalid email or password. Please verify your credentials and try again.', rawEmail));
  }

  if (!user.isActive) {
    res.status(403).setHeader('Content-Type', 'text/html');
    return res.send(renderLoginForm(q, 'Your account is deactivated. Please contact support.', rawEmail));
  }

  return finishAuthorize(res, user._id, {
    clientId,
    redirectUri,
    state,
    codeChallenge,
  });
}

function finishAuthorize(res, userId, { clientId, redirectUri, state, codeChallenge }) {
  const code = jwt.sign(
    {
      sub: userId.toString(),
      azp: clientId,
      rdu: redirectUri,
      cch: codeChallenge || null,
      typ: 'azc',
    },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );
  try {
    const url = new URL(redirectUri);
    url.searchParams.set('code', code);
    if (state) url.searchParams.set('state', state);
    const targetUrl = url.toString();

    res.status(303);
    res.setHeader('Location', targetUrl);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorizing...</title>
  <meta http-equiv="refresh" content="0;url=${targetUrl.replace(/"/g, '&quot;')}">
  <script>window.location.replace(${JSON.stringify(targetUrl)});</script>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#f8fafc;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px;">
  <div style="background:#1e293b;padding:32px 28px;border-radius:14px;border:1px solid #334155;max-width:380px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.5);">
    <div style="font-size:32px;margin-bottom:12px;">✅</div>
    <h1 style="font-size:18px;margin:0 0 8px;font-weight:700;color:#ffffff;">Authorization Successful</h1>
    <p style="color:#94a3b8;font-size:13.5px;margin:0 0 20px;line-height:1.5;">Redirecting back to your AI client...</p>
    <a href="${targetUrl.replace(/"/g, '&quot;')}" style="display:inline-block;padding:10px 16px;background:#38bdf8;color:#0f172a;text-decoration:none;border-radius:8px;font-size:13px;font-weight:700;">Click if not redirected automatically &rarr;</a>
  </div>
</body>
</html>`);
  } catch {
    return res.status(400).json({ error: 'invalid_redirect_uri' });
  }
}

export async function oauthToken(req, res) {
  const client = await authenticateOAuthClient(req);
  if (!client) return res.status(401).json({ error: 'invalid_client' });

  const grantType = req.body?.grant_type;

  if (grantType === 'authorization_code') {
    if (!client.grantTypes?.includes('authorization_code')) {
      return res.status(400).json({ error: 'unsupported_grant_type' });
    }

    const code = req.body?.code;
    const verifier = req.body?.code_verifier;
    const redirectUri = req.body?.redirect_uri;
    let cd;
    try {
      cd = jwt.verify(code, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ error: 'invalid_grant' });
    }

    if (cd.typ !== 'azc' || cd.azp !== client.clientId || !redirectUri || cd.rdu !== redirectUri) {
      return res.status(400).json({ error: 'invalid_grant' });
    }

    if (cd.cch) {
      const expected = crypto
        .createHash('sha256')
        .update(verifier || '')
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      if (expected !== cd.cch) {
        return res.status(400).json({ error: 'invalid_grant' });
      }
    }

    const accessToken = jwt.sign(
      { id: cd.sub, mcp: true },
      process.env.JWT_SECRET,
      { expiresIn: '720h' }
    );
    return res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 720 * 3600,
      scope: 'mcp',
    });
  }

  if (grantType === 'client_credentials') {
    if (!client.static || !client.grantTypes?.includes('client_credentials')) {
      return res.status(400).json({ error: 'unsupported_grant_type' });
    }

    const userId = process.env.MCP_OAUTH_USER_ID;
    if (!userId) return res.status(500).json({ error: 'server_misconfigured' });

    const accessToken = jwt.sign(
      { id: userId, mcp: true },
      process.env.JWT_SECRET,
      { expiresIn: '720h' }
    );
    return res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 720 * 3600,
      scope: 'mcp',
    });
  }

  return res.status(400).json({ error: 'unsupported_grant_type' });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function jsonResult(data, isError = false) {
  return {
    content: [
      {
        type: 'text',
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
    isError,
  };
}

// Build a fresh MCP Server. `ctx` is a mutable per-connection object ({ userId }).
function buildServer(ctx) {
  const server = new Server(
    { name: 'daytoday-mcp', version: '2.0.0' },
    { capabilities: { tools: {} } }
  );

  const tools = [
    // 1. Account & Security Tools
    {
      name: 'get_security_profile',
      description:
        "Retrieve the authenticated user's profile and 2FA enablement status. Never returns passwords or 2FA secrets.",
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'list_active_devices',
      description:
        'List all active sessions/devices for the authenticated user, including IP, OS, browser, device name, and expiration.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'revoke_device_session',
      description:
        'Revoke (log out) a specific device session. The session must belong to the authenticated user.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'The MongoDB _id of the session/device to revoke.',
          },
        },
        required: ['sessionId'],
      },
    },
    {
      name: 'get_account_audit_log',
      description:
        'Return recent security/device activity for the authenticated user, derived from device history and active sessions.',
      inputSchema: { type: 'object', properties: {} },
    },

    // 2. Drive & Storage Tools
    {
      name: 'get_storage_quota',
      description:
        'Get Drive storage usage metrics: bytes used, formatted human-readable size (MB/GB), 5GB quota limit, percentage used, and total file count.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'list_drive_files',
      description:
        'List files and folders in DayToDay Drive for the authenticated user. Supports folder navigation, trash viewing, and keyword filtering.',
      inputSchema: {
        type: 'object',
        properties: {
          folderId: {
            type: 'string',
            description: "Parent folder ID to list, or 'root' / omit for the root directory.",
          },
          trash: {
            type: 'boolean',
            description: 'Set to true to list items currently in the trash bin.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of files to return (default 50).',
          },
        },
      },
    },
    {
      name: 'search_drive',
      description:
        'Search files and folders across Drive by name, keyword, or MIME type.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Keyword to search for in file or folder names.',
          },
          type: {
            type: 'string',
            description: "Optional filter: 'all', 'file', 'folder', 'image', 'document', 'pdf'.",
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'create_drive_folder',
      description:
        'Create a new folder in Drive at the root level or inside a parent folder.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the folder to create.',
          },
          parentId: {
            type: 'string',
            description: 'Optional parent folder MongoDB ID.',
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'rename_drive_item',
      description:
        'Rename an existing file or folder in Drive.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The ID of the file or folder to rename.',
          },
          type: {
            type: 'string',
            enum: ['file', 'folder'],
            description: "Whether the item is a 'file' or 'folder'.",
          },
          name: {
            type: 'string',
            description: 'The new name for the item.',
          },
        },
        required: ['id', 'type', 'name'],
      },
    },
    {
      name: 'delete_drive_item',
      description:
        'Move a file or folder in Drive to the trash bin.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The ID of the file or folder to move to trash.',
          },
          type: {
            type: 'string',
            enum: ['file', 'folder'],
            description: "Whether the item is a 'file' or 'folder'.",
          },
        },
        required: ['id', 'type'],
      },
    },
    {
      name: 'restore_drive_item',
      description:
        'Restore a file or folder from the trash bin back to its original location.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The ID of the file or folder to restore.',
          },
          type: {
            type: 'string',
            enum: ['file', 'folder'],
            description: "Whether the item is a 'file' or 'folder'.",
          },
        },
        required: ['id', 'type'],
      },
    },
    {
      name: 'delete_permanent_drive_item',
      description:
        'Permanently delete a file or folder from Drive and purge its cloud storage.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The ID of the file or folder to permanently delete.',
          },
          type: {
            type: 'string',
            enum: ['file', 'folder'],
            description: "Whether the item is a 'file' or 'folder'.",
          },
        },
        required: ['id', 'type'],
      },
    },
    {
      name: 'get_file_download_url',
      description:
        'Generate a secure, time-limited presigned download or preview URL for a file in Drive.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: {
            type: 'string',
            description: 'The ID of the file to generate the download URL for.',
          },
          download: {
            type: 'boolean',
            description: 'Set to true to force browser attachment download header.',
          },
        },
        required: ['fileId'],
      },
    },

    // 3. Vault & Status Tools
    {
      name: 'get_vault_status',
      description:
        'Check if the authenticated user has initialized their zero-knowledge encrypted vault.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'list_vault_items',
      description:
        'List metadata of encrypted items stored in the user vault (ID, item type like login/card/note/identity, favorite flag, updated time). Note: item contents remain zero-knowledge client-encrypted for maximum security.',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: "Optional filter by item type: 'all', 'login', 'card', 'secure_note', 'identity'.",
          },
          favoritesOnly: {
            type: 'boolean',
            description: 'Filter for items marked as favorite.',
          },
        },
      },
    },
    {
      name: 'toggle_vault_favorite',
      description:
        'Toggle or set the favorite status of a vault item.',
      inputSchema: {
        type: 'object',
        properties: {
          itemId: {
            type: 'string',
            description: 'The ID of the vault item.',
          },
          isFavorite: {
            type: 'boolean',
            description: 'Optional explicit favorite status. If omitted, flips the current status.',
          },
        },
        required: ['itemId'],
      },
    },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Tools require an authenticated user.
    if (!ctx.userId) {
      return jsonResult(
        { success: false, error: 'Not authenticated' },
        true
      );
    }

    try {
      switch (name) {
        // -------------------------------------------------------------------
        // 1. Account & Security
        // -------------------------------------------------------------------
        case 'get_security_profile': {
          const u = await User.findById(ctx.userId).select(
            '-password -twoFactorCode -twoFactorCodeExpires'
          );
          if (!u) throw new Error('User not found');
          return jsonResult({
            name: u.name,
            email: u.email,
            twoFactorEnabled: u.twoFactorEnabled,
            isActive: u.isActive,
            memberSince: u.createdAt,
            trustedDeviceCount: u.devices?.length ?? 0,
          });
        }

        case 'list_active_devices': {
          const sessions = await Session.find({
            userId: ctx.userId,
            isActive: true,
          }).sort({ createdAt: -1 });

          const devices = sessions.map((s) => ({
            sessionId: s._id,
            deviceName: s.deviceInfo?.deviceName,
            browser: s.deviceInfo?.browser,
            os: s.deviceInfo?.os,
            ip: s.deviceInfo?.ip,
            createdAt: s.createdAt,
            expiresAt: s.expiresAt,
            isValid: s.isValid(),
          }));

          return jsonResult({ count: devices.length, devices });
        }

        case 'revoke_device_session': {
          const { sessionId } = args || {};
          if (!sessionId) throw new Error('sessionId is required');

          const session = await Session.findOne({
            _id: sessionId,
            userId: ctx.userId,
            isActive: true,
          });
          if (!session) {
            return jsonResult(
              {
                success: false,
                message:
                  'Session not found, already revoked, or does not belong to you.',
              },
              true
            );
          }

          session.isActive = false;
          await session.save();

          const u = await User.findById(ctx.userId);
          if (u && u.devices?.some((d) => d.deviceId === session.deviceId)) {
            u.devices = u.devices.filter(
              (d) => d.deviceId !== session.deviceId
            );
            await u.save();
          }

          return jsonResult({
            success: true,
            message: 'Device session revoked successfully.',
            sessionId,
          });
        }

        case 'get_account_audit_log': {
          const u = await User.findById(ctx.userId).select('devices');
          const recentDevices = (u?.devices || [])
            .map((d) => ({
              deviceName: d.deviceName,
              browser: d.browser,
              os: d.os,
              ip: d.ip,
              lastActive: d.lastActive,
              firstSeen: d.createdAt,
            }))
            .sort(
              (a, b) => new Date(b.lastActive) - new Date(a.lastActive)
            );

          const activeSessions = await Session.find({
            userId: ctx.userId,
            isActive: true,
          }).select('deviceInfo createdAt expiresAt');

          return jsonResult({
            recentDevices,
            activeSessions: activeSessions.map((s) => ({
              sessionId: s._id,
              ...s.deviceInfo,
              createdAt: s.createdAt,
              expiresAt: s.expiresAt,
            })),
          });
        }

        // -------------------------------------------------------------------
        // 2. Drive & Storage Management
        // -------------------------------------------------------------------
        case 'get_storage_quota': {
          const usedBytes = await getUserStorageUsage(ctx.userId);
          const totalFiles = await DriveFile.countDocuments({ user: ctx.userId, isTrash: false });
          const totalFolders = await DriveFolder.countDocuments({ user: ctx.userId, isTrash: false });
          const usedMB = (usedBytes / (1024 * 1024)).toFixed(2);
          const usedGB = (usedBytes / (1024 * 1024 * 1024)).toFixed(3);
          const percentUsed = ((usedBytes / QUOTA_LIMIT) * 100).toFixed(2);

          return jsonResult({
            usedBytes,
            usedFormatted: usedBytes > 1024 * 1024 * 1024 ? `${usedGB} GB` : `${usedMB} MB`,
            quotaLimitBytes: QUOTA_LIMIT,
            quotaLimitFormatted: '5.00 GB',
            percentUsed: `${percentUsed}%`,
            totalFiles,
            totalFolders,
          });
        }

        case 'list_drive_files': {
          const { folderId, trash, limit = 50 } = args || {};
          const isTrash = trash === true;

          const fileFilter = { user: ctx.userId, isTrash };
          if (!isTrash) {
            fileFilter.folder = folderId && folderId !== 'root' ? folderId : null;
          }

          const folderFilter = { user: ctx.userId, isTrash };
          if (!isTrash) {
            folderFilter.parent = folderId && folderId !== 'root' ? folderId : null;
          }

          const [fileDocs, folderDocs, usedBytes] = await Promise.all([
            DriveFile.find(fileFilter).sort({ createdAt: -1 }).limit(Math.min(limit, 200)),
            DriveFolder.find(folderFilter).sort({ name: 1 }),
            getUserStorageUsage(ctx.userId),
          ]);

          const files = fileDocs.map((f) => ({
            id: f._id,
            name: f.name,
            size: f.size,
            sizeFormatted: `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
            mimeType: f.mimeType,
            folder: f.folder,
            isTrash: f.isTrash,
            isPublic: f.isPublic,
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
          }));

          const folders = folderDocs.map((fd) => ({
            id: fd._id,
            name: fd.name,
            parent: fd.parent,
            isTrash: fd.isTrash,
            createdAt: fd.createdAt,
          }));

          return jsonResult({
            folderCount: folders.length,
            fileCount: files.length,
            folders,
            files,
            storageUsedBytes: usedBytes,
            storageLimitBytes: QUOTA_LIMIT,
          });
        }

        case 'search_drive': {
          const { query, type = 'all' } = args || {};
          if (!query || typeof query !== 'string') {
            throw new Error('Search query is required');
          }

          const regex = new RegExp(query.trim(), 'i');
          const fileFilter = { user: ctx.userId, isTrash: false, name: regex };
          const folderFilter = { user: ctx.userId, isTrash: false, name: regex };

          if (type === 'image') fileFilter.mimeType = /^image\//i;
          else if (type === 'pdf') fileFilter.mimeType = /pdf/i;
          else if (type === 'document') fileFilter.mimeType = /(text|document|sheet|pdf|word)/i;

          const [files, folders] = await Promise.all([
            type === 'folder' ? [] : DriveFile.find(fileFilter).limit(50),
            type !== 'all' && type !== 'folder' ? [] : DriveFolder.find(folderFilter).limit(20),
          ]);

          return jsonResult({
            query,
            totalMatches: files.length + folders.length,
            folders: folders.map((f) => ({ id: f._id, name: f.name, parent: f.parent })),
            files: files.map((f) => ({
              id: f._id,
              name: f.name,
              size: f.size,
              mimeType: f.mimeType,
              folder: f.folder,
              createdAt: f.createdAt,
            })),
          });
        }

        case 'create_drive_folder': {
          const { name, parentId } = args || {};
          if (!name || !name.trim()) throw new Error('Folder name is required');

          const folder = new DriveFolder({
            user: ctx.userId,
            name: name.trim(),
            parent: parentId || null,
          });
          await folder.save();

          return jsonResult({
            success: true,
            message: 'Folder created successfully.',
            folder: {
              id: folder._id,
              name: folder.name,
              parent: folder.parent,
              createdAt: folder.createdAt,
            },
          });
        }

        case 'rename_drive_item': {
          const { id, type, name } = args || {};
          if (!id) throw new Error('Item ID is required');
          if (!name || !name.trim()) throw new Error('New name is required');

          if (type === 'file') {
            const file = await DriveFile.findOneAndUpdate(
              { _id: id, user: ctx.userId },
              { name: name.trim() },
              { new: true }
            );
            if (!file) throw new Error('File not found');
            return jsonResult({ success: true, message: 'File renamed', item: file });
          } else {
            const folder = await DriveFolder.findOneAndUpdate(
              { _id: id, user: ctx.userId },
              { name: name.trim() },
              { new: true }
            );
            if (!folder) throw new Error('Folder not found');
            return jsonResult({ success: true, message: 'Folder renamed', item: folder });
          }
        }

        case 'delete_drive_item': {
          const { id, type } = args || {};
          if (!id) throw new Error('Item ID is required');

          if (type === 'file') {
            const file = await DriveFile.findOneAndUpdate(
              { _id: id, user: ctx.userId },
              { isTrash: true, trashDate: new Date() },
              { new: true }
            );
            if (!file) throw new Error('File not found');
            return jsonResult({ success: true, message: 'File moved to trash', id });
          } else {
            const folder = await DriveFolder.findOneAndUpdate(
              { _id: id, user: ctx.userId },
              { isTrash: true, trashDate: new Date() },
              { new: true }
            );
            if (!folder) throw new Error('Folder not found');
            return jsonResult({ success: true, message: 'Folder moved to trash', id });
          }
        }

        case 'restore_drive_item': {
          const { id, type } = args || {};
          if (!id) throw new Error('Item ID is required');

          if (type === 'file') {
            const file = await DriveFile.findOneAndUpdate(
              { _id: id, user: ctx.userId },
              { isTrash: false, trashDate: null },
              { new: true }
            );
            if (!file) throw new Error('File not found');
            return jsonResult({ success: true, message: 'File restored from trash', id });
          } else {
            const folder = await DriveFolder.findOneAndUpdate(
              { _id: id, user: ctx.userId },
              { isTrash: false, trashDate: null },
              { new: true }
            );
            if (!folder) throw new Error('Folder not found');
            return jsonResult({ success: true, message: 'Folder restored from trash', id });
          }
        }

        case 'delete_permanent_drive_item': {
          const { id, type } = args || {};
          if (!id) throw new Error('Item ID is required');
          const r2 = getR2Client();

          if (type === 'file') {
            const file = await DriveFile.findOne({ _id: id, user: ctx.userId });
            if (!file) throw new Error('File not found');

            if (r2 && file.r2Key) {
              try {
                await r2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: file.r2Key }));
              } catch (err) {
                console.error('R2 deletion error:', err);
              }
            }
            await file.deleteOne();
            return jsonResult({ success: true, message: 'File permanently deleted', id });
          } else {
            const deleteFolderRecursive = async (folderId) => {
              const subfolders = await DriveFolder.find({ parent: folderId, user: ctx.userId });
              for (const sub of subfolders) {
                await deleteFolderRecursive(sub._id);
              }
              const files = await DriveFile.find({ folder: folderId, user: ctx.userId });
              for (const f of files) {
                if (r2 && f.r2Key) {
                  try {
                    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: f.r2Key }));
                  } catch (e) {
                    console.error(e);
                  }
                }
                await f.deleteOne();
              }
              await DriveFolder.deleteOne({ _id: folderId });
            };

            await deleteFolderRecursive(id);
            return jsonResult({ success: true, message: 'Folder and contents permanently deleted', id });
          }
        }

        case 'get_file_download_url': {
          const { fileId, download } = args || {};
          if (!fileId) throw new Error('fileId is required');

          const file = await DriveFile.findOne({ _id: fileId, user: ctx.userId });
          if (!file) throw new Error('File not found');

          const r2 = getR2Client();
          if (!r2) {
            throw new Error('Cloud storage (Cloudflare R2) is not configured on this server.');
          }

          const disposition = download ? 'attachment' : 'inline';
          const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: file.r2Key,
            ResponseContentDisposition: `${disposition}; filename="${file.name}"`,
          });

          const url = await getSignedUrl(r2, command, { expiresIn: 3600 });
          return jsonResult({
            fileId: file._id,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.mimeType,
            downloadUrl: url,
            expiresInSeconds: 3600,
          });
        }

        // -------------------------------------------------------------------
        // 3. Vault & Status
        // -------------------------------------------------------------------
        case 'get_vault_status': {
          const settings = await VaultSettings.findOne({ user: ctx.userId });
          const itemCount = await VaultItem.countDocuments({ user: ctx.userId });
          const favCount = await VaultItem.countDocuments({ user: ctx.userId, isFavorite: true });

          return jsonResult({
            isInitialized: !!settings,
            totalItems: itemCount,
            favoriteItems: favCount,
            customTemplatesCount: settings?.customTemplates?.length || 0,
            hasSalt: !!settings?.salt,
          });
        }

        case 'list_vault_items': {
          const { type, favoritesOnly } = args || {};
          const filter = { user: ctx.userId };
          if (type && type !== 'all') filter.type = type;
          if (favoritesOnly) filter.isFavorite = true;

          const items = await VaultItem.find(filter).sort({ updatedAt: -1 });

          return jsonResult({
            count: items.length,
            items: items.map((item) => ({
              id: item._id,
              type: item.type,
              isFavorite: item.isFavorite,
              updatedAt: item.updatedAt,
              createdAt: item.createdAt,
            })),
            note: 'Vault item sensitive secrets are protected with client-side zero-knowledge AES-GCM encryption.',
          });
        }

        case 'toggle_vault_favorite': {
          const { itemId, isFavorite } = args || {};
          if (!itemId) throw new Error('itemId is required');

          const item = await VaultItem.findOne({ _id: itemId, user: ctx.userId });
          if (!item) throw new Error('Vault item not found');

          item.isFavorite = isFavorite !== undefined ? Boolean(isFavorite) : !item.isFavorite;
          item.updatedAt = Date.now();
          await item.save();

          return jsonResult({
            success: true,
            itemId: item._id,
            isFavorite: item.isFavorite,
          });
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (err) {
      return jsonResult(
        { success: false, error: err.message },
        true
      );
    }
  });

  return server;
}

export { buildServer };
