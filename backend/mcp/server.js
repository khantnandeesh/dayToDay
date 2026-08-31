import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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

function getMimeTypeFromFileName(fileName = '') {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const mapDigits = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    csv: 'text/csv',
    html: 'text/html',
    htm: 'text/html',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip: 'application/zip',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
  };
  return mapDigits[ext] || 'application/octet-stream';
}

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// ---------------------------------------------------------------------------
// In-Memory Upload Chunk Manager for Large AI Attachment Handoffs
// ---------------------------------------------------------------------------
const chunkUploadSessions = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of chunkUploadSessions.entries()) {
    if (now - session.lastActive > 30 * 60 * 1000) {
      chunkUploadSessions.delete(id);
    }
  }
}, 10 * 60 * 1000);

// ---------------------------------------------------------------------------
// Zero-Knowledge PBKDF2 & AES-256-GCM Crypto Helpers (Compatible with WebCrypto)
// ---------------------------------------------------------------------------
const PBKDF2_ITERATIONS = 600000;

function deriveVaultKeySync(masterPassword, saltHex) {
  const saltBuf = Buffer.from(saltHex, 'hex');
  return crypto.pbkdf2Sync(masterPassword, saltBuf, PBKDF2_ITERATIONS, 32, 'sha256');
}

function verifyVaultKey(key, verifierB64, verifierIvHex) {
  try {
    const combinedBuf = Buffer.from(verifierB64, 'base64');
    if (combinedBuf.length < 16) return false;
    const ciphertextBuf = combinedBuf.subarray(0, combinedBuf.length - 16);
    const authTagBuf = combinedBuf.subarray(combinedBuf.length - 16);
    const iv = Buffer.from(verifierIvHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTagBuf);
    let decrypted = decipher.update(ciphertextBuf, null, 'utf8');
    decrypted += decipher.final('utf8');
    const parsed = JSON.parse(decrypted);
    return parsed?.status === 'valid';
  } catch {
    return false;
  }
}

function decryptVaultBlobSync(encryptedDataB64, ivHex, key) {
  const combinedBuf = Buffer.from(encryptedDataB64, 'base64');
  if (combinedBuf.length < 16) {
    throw new Error('Corrupted encrypted data payload.');
  }
  const ciphertextBuf = combinedBuf.subarray(0, combinedBuf.length - 16);
  const authTagBuf = combinedBuf.subarray(combinedBuf.length - 16);
  const iv = Buffer.from(ivHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTagBuf);
  let decrypted = decipher.update(ciphertextBuf, null, 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

function encryptVaultBlobSync(payloadObj, key) {
  const jsonStr = JSON.stringify(payloadObj);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(jsonStr, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([encrypted, authTag]);

  return {
    encryptedData: combined.toString('base64'),
    iv: iv.toString('hex'),
  };
}

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
    grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
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
  const rawGrantTypes = body.grant_types;
  const responseTypes = Array.isArray(body.response_types) && body.response_types.length > 0
    ? body.response_types
    : ['code'];
  const tokenEndpointAuthMethod = ['client_secret_basic', 'client_secret_post', 'none'].includes(body.token_endpoint_auth_method)
    ? body.token_endpoint_auth_method
    : 'client_secret_basic';

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

  const allowedGrants = ['authorization_code', 'refresh_token', 'client_credentials'];
  let grantTypes = ['authorization_code', 'refresh_token'];
  if (Array.isArray(rawGrantTypes) && rawGrantTypes.length > 0) {
    grantTypes = rawGrantTypes.filter((g) => allowedGrants.includes(g));
    if (grantTypes.length === 0) {
      grantTypes = ['authorization_code', 'refresh_token'];
    }
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
    grantTypes,
    responseTypes: ['code'],
    tokenEndpointAuthMethod,
  });

  const registration = {
    client_id: clientId,
    client_id_issued_at: clientIdIssuedAt,
    client_secret_expires_at: 0,
    client_name: clientName,
    redirect_uris: redirectUris,
    grant_types: grantTypes,
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

    // Standard RFC 6749 302 redirect + Location header
    return res.redirect(302, targetUrl);
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
    const refreshToken = jwt.sign(
      { id: cd.sub, azp: client.clientId, typ: 'rt' },
      process.env.JWT_SECRET,
      { expiresIn: '365d' }
    );
    return res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 720 * 3600,
      refresh_token: refreshToken,
      scope: 'mcp',
    });
  }

  if (grantType === 'refresh_token') {
    const refreshToken = req.body?.refresh_token;
    let rt;
    try {
      rt = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ error: 'invalid_grant' });
    }
    if (rt.typ !== 'rt' || rt.azp !== client.clientId) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
    const newAccessToken = jwt.sign(
      { id: rt.id, mcp: true },
      process.env.JWT_SECRET,
      { expiresIn: '720h' }
    );
    return res.json({
      access_token: newAccessToken,
      token_type: 'Bearer',
      expires_in: 720 * 3600,
      refresh_token: refreshToken,
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
    {
      name: 'request_upload_url',
      description:
        "Request a direct Cloudflare R2 presigned PUT upload URL and an MCP HTTP direct upload endpoint. Use this tool when uploading a large file or ChatGPT attachment (such as a PDF, document, or image) to upload it directly via Python, curl, or HTTP without hitting JSON-RPC parameter limits.",
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: "The name of the file with extension, e.g. 'oraclecetificate.pdf', 'report.pdf'.",
          },
          mimeType: {
            type: 'string',
            description: "Optional MIME type (e.g. 'application/pdf').",
          },
          size: {
            type: 'number',
            description: 'Optional estimated size of the file in bytes.',
          },
          folderId: {
            type: 'string',
            description: "Optional folder ID or folder name (e.g. 'Certificates', 'Work').",
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'upload_file_chunk',
      description:
        'Upload large files or attachments in small base64 chunks (e.g. 50KB-100KB per chunk). Perfect for environments like ChatGPT where single-argument payload sizes are restricted.',
      inputSchema: {
        type: 'object',
        properties: {
          uploadId: {
            type: 'string',
            description: "A unique session ID for this upload (e.g. 'upload-oracle-pdf-1').",
          },
          name: {
            type: 'string',
            description: "The filename with extension, e.g. 'oraclecetificate.pdf'.",
          },
          chunkIndex: {
            type: 'number',
            description: '0-based index of this chunk (0, 1, 2...).',
          },
          totalChunks: {
            type: 'number',
            description: 'Total number of chunks in this upload.',
          },
          chunkBase64: {
            type: 'string',
            description: 'Base64-encoded binary content for this specific chunk.',
          },
          mimeType: {
            type: 'string',
            description: "Optional MIME type, e.g. 'application/pdf'.",
          },
          folderId: {
            type: 'string',
            description: 'Optional destination folder ID or folder name.',
          },
        },
        required: ['uploadId', 'name', 'chunkIndex', 'totalChunks', 'chunkBase64'],
      },
    },
    {
      name: 'finalize_file_upload',
      description: 'Confirm and finalize a file uploaded via presigned uploadUrl.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: {
            type: 'string',
            description: 'The file ID returned from request_upload_url.',
          },
          size: {
            type: 'number',
            description: 'Final size in bytes if known.',
          },
        },
        required: ['fileId'],
      },
    },
    {
      name: 'upload_file',
      description:
        "Upload any file (PDF, document, image, report, text, code, etc.) directly into the user's DayToDay Drive. When the user attaches or uploads a PDF or file in ChatGPT, Gemini, or Claude, call this tool with the file's base64 content or text to store it in DayToDay Drive.",
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: "The name of the file with extension, e.g. 'Report.pdf', 'Invoice_2026.pdf', 'Notes.txt', 'contract.pdf'.",
          },
          contentBase64: {
            type: 'string',
            description: 'Base64-encoded binary content of the file (required for PDFs, binary files, images, documents).',
          },
          textContent: {
            type: 'string',
            description: 'Raw text content (for markdown, text, code, CSV, HTML, JSON files).',
          },
          sourceUrl: {
            type: 'string',
            description: 'Optional public download URL to fetch and save directly to DayToDay Drive.',
          },
          mimeType: {
            type: 'string',
            description: "Optional MIME type (e.g. 'application/pdf', 'image/png', 'text/plain'). Auto-detected from file extension if omitted.",
          },
          folderId: {
            type: 'string',
            description: "Optional folder ID or folder name in DayToDay Drive (or 'root'). If a folder name is provided and doesn't exist, it will be automatically created.",
          },
        },
        required: ['name'],
      },
    },

    // 3. Vault & Password Management Tools
    {
      name: 'get_vault_status',
      description:
        'Check if the authenticated user has initialized their zero-knowledge encrypted vault.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'list_vault_items',
      description:
        'List metadata of encrypted items stored in the user vault (ID, item type like website/bank/wifi/note/wallet, favorite flag, updated time). Does not require master password.',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: "Optional filter by item type: 'all', 'website', 'bank', 'wifi', 'wallet', 'note', 'custom'.",
          },
          favoritesOnly: {
            type: 'boolean',
            description: 'Filter for items marked as favorite.',
          },
        },
      },
    },
    {
      name: 'list_passwords',
      description:
        'List vault password accounts and item headers. If master_password is provided, decrypts and lists account titles, usernames, websites, and field keys (with passwords masked). If master_password is omitted, returns item IDs and metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          master_password: {
            type: 'string',
            description:
              'Optional DayToDay Master Password. When provided, allows decrypting and listing usernames/titles. If omitted, returns item IDs and metadata or prompts for master_password.',
          },
          type: {
            type: 'string',
            description: "Optional filter by type: 'website', 'bank', 'wifi', 'wallet', 'note', 'custom'.",
          },
          query: {
            type: 'string',
            description: 'Search filter to match against item title, username, or website.',
          },
        },
      },
    },
    {
      name: 'get_password',
      description:
        'Retrieve and decrypt a specific vault item or credential (including username, password, URLs, notes, and custom fields). Requires the user master_password.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The Vault Item ID or exact item Title to retrieve.',
          },
          master_password: {
            type: 'string',
            description:
              'The user DayToDay Master Password used to decrypt this vault item. If not known, ask the user.',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'create_password',
      description:
        'Encrypt and save a new password or credential into the user DayToDay Vault with zero-knowledge AES-GCM encryption. Requires master_password.',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: "The name/title of the credential, e.g. 'Google Account', 'GitHub', 'Chase Bank'.",
          },
          type: {
            type: 'string',
            enum: ['website', 'bank', 'wifi', 'wallet', 'note', 'custom'],
            description: "Type of the credential. Defaults to 'website'.",
          },
          username: {
            type: 'string',
            description: 'The username, email, or login identifier.',
          },
          password: {
            type: 'string',
            description: 'The password or secret to store.',
          },
          website: {
            type: 'string',
            description: "Optional website URL, e.g. 'https://github.com'.",
          },
          notes: {
            type: 'string',
            description: 'Optional secure notes or additional info.',
          },
          fields: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                value: { type: 'string' },
                type: { type: 'string', enum: ['text', 'password', 'email', 'url', 'textarea', 'number', 'date'] },
              },
              required: ['label', 'value'],
            },
            description: 'Optional additional custom fields for this item.',
          },
          isFavorite: {
            type: 'boolean',
            description: 'Set to true to mark this credential as a favorite.',
          },
          master_password: {
            type: 'string',
            description:
              'The user DayToDay Master Password used to encrypt the item before saving. If not provided, ask the user.',
          },
        },
        required: ['title', 'password', 'master_password'],
      },
    },
    {
      name: 'update_password',
      description:
        'Update or modify an existing password or credential item in the vault. Encrypts the updated record using the master_password.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The ID of the vault item to update.',
          },
          title: {
            type: 'string',
            description: 'Updated title/name.',
          },
          type: {
            type: 'string',
            enum: ['website', 'bank', 'wifi', 'wallet', 'note', 'custom'],
            description: 'Updated category type.',
          },
          username: {
            type: 'string',
            description: 'Updated username or email.',
          },
          password: {
            type: 'string',
            description: 'Updated password or secret value.',
          },
          website: {
            type: 'string',
            description: 'Updated website URL.',
          },
          notes: {
            type: 'string',
            description: 'Updated secure notes.',
          },
          fields: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                value: { type: 'string' },
                type: { type: 'string', enum: ['text', 'password', 'email', 'url', 'textarea', 'number', 'date'] },
              },
              required: ['label', 'value'],
            },
            description: 'Updated custom fields list.',
          },
          isFavorite: {
            type: 'boolean',
            description: 'Mark or unmark as favorite.',
          },
          master_password: {
            type: 'string',
            description: 'The user DayToDay Master Password required to decrypt and re-encrypt the item.',
          },
        },
        required: ['id', 'master_password'],
      },
    },
    {
      name: 'delete_vault_item',
      description: 'Delete an item from the user DayToDay Vault by ID.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The ID of the vault item to delete.',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'generate_password',
      description:
        'Generate a cryptographically secure, high-entropy password or passphrase with customizable character rules.',
      inputSchema: {
        type: 'object',
        properties: {
          length: {
            type: 'number',
            description: 'Length of the password (default: 20, min: 8, max: 128).',
          },
          includeUppercase: {
            type: 'boolean',
            description: 'Include uppercase letters (default: true).',
          },
          includeLowercase: {
            type: 'boolean',
            description: 'Include lowercase letters (default: true).',
          },
          includeNumbers: {
            type: 'boolean',
            description: 'Include numbers 0-9 (default: true).',
          },
          includeSymbols: {
            type: 'boolean',
            description: 'Include special characters !@#$%^&*()_+-=[]{}|;:,.<>? (default: true).',
          },
          avoidAmbiguous: {
            type: 'boolean',
            description: 'Avoid confusing characters like l, 1, I, O, 0 (default: false).',
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

        case 'request_upload_url':
        case 'get_upload_url': {
          const { name, fileName, filename, mimeType, contentType, size = 0, folderId, folder_id, folder } = args || {};
          const rawName = name || fileName || filename;
          if (!rawName) throw new Error('File name is required (e.g. oraclecetificate.pdf)');

          const targetFolderParam = folderId || folder_id || folder;
          const detectedMimeType = mimeType || contentType || getMimeTypeFromFileName(rawName);

          const usedBytes = await getUserStorageUsage(ctx.userId);
          if (usedBytes + (Number(size) || 0) > QUOTA_LIMIT) {
            return jsonResult(
              {
                success: false,
                error: `Storage quota exceeded. Currently using ${formatBytes(usedBytes)} / 5 GB limit.`,
              },
              true
            );
          }

          // Resolve destination folder
          let resolvedFolderId = null;
          let resolvedFolderName = 'Root';
          if (targetFolderParam && targetFolderParam !== 'root') {
            if (targetFolderParam.match(/^[0-9a-fA-F]{24}$/)) {
              const folderDoc = await DriveFolder.findOne({ _id: targetFolderParam, user: ctx.userId });
              if (folderDoc) {
                resolvedFolderId = folderDoc._id;
                resolvedFolderName = folderDoc.name;
              }
            } else {
              let folderDoc = await DriveFolder.findOne({
                name: targetFolderParam,
                user: ctx.userId,
                isTrash: false,
              });
              if (!folderDoc) {
                folderDoc = await DriveFolder.create({ user: ctx.userId, name: targetFolderParam });
              }
              resolvedFolderId = folderDoc._id;
              resolvedFolderName = folderDoc.name;
            }
          }

          const randomHex = crypto.randomBytes(8).toString('hex');
          const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
          const r2Key = `users/${ctx.userId}/${randomHex}-${safeName}`;

          const r2 = getR2Client();
          if (!r2) {
            throw new Error('Cloud storage (Cloudflare R2) is not configured.');
          }

          const putCmd = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: r2Key,
            ContentType: detectedMimeType,
          });
          const presignedUploadUrl = await getSignedUrl(r2, putCmd, { expiresIn: 7200 });

          // Pre-create or stage the file record in MongoDB so it is ready immediately once uploaded
          const driveFile = await DriveFile.create({
            user: ctx.userId,
            folder: resolvedFolderId,
            name: rawName,
            size: Number(size) || 0,
            mimeType: detectedMimeType,
            r2Key,
          });

          // Generate single-use or scoped token for direct HTTP server upload fallback
          const directToken = jwt.sign(
            { id: ctx.userId, mcp: true, purpose: 'direct_upload', fileId: driveFile._id },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
          );

          const baseUrl =
            process.env.BACKEND_URL ||
            process.env.BASE_URL ||
            'https://ais-dev-2k24isclta7xezqnjjjd3k-539212626537.asia-southeast1.run.app';
          const httpUploadUrl = `${baseUrl}/mcp/upload?token=${directToken}&fileId=${driveFile._id}&name=${encodeURIComponent(
            rawName
          )}`;

          return jsonResult({
            success: true,
            message: `Upload URL successfully generated for '${rawName}'. You can upload the attachment binary directly to uploadUrl.`,
            uploadUrl: presignedUploadUrl,
            httpUploadUrl,
            fileId: driveFile._id,
            folder: resolvedFolderName,
            mimeType: detectedMimeType,
            pythonSnippet: `import requests\nwith open('${rawName}', 'rb') as f:\n    r = requests.put('${presignedUploadUrl}', data=f, headers={'Content-Type': '${detectedMimeType}'})\nprint('Upload status:', r.status_code)`,
            curlCommand: `curl -X PUT -T "${rawName}" -H "Content-Type: ${detectedMimeType}" "${presignedUploadUrl}"`,
            instructions: `1. In Python: requests.put(uploadUrl, data=open(file_path, 'rb'), headers={'Content-Type': '${detectedMimeType}'})\n2. Or send via upload_file_chunk\n3. The file is already registered in DayToDay Drive!`,
          });
        }

        case 'upload_file_chunk': {
          const { uploadId, name, chunkIndex, totalChunks, chunkBase64, mimeType, folderId } = args || {};
          if (!uploadId) throw new Error('uploadId is required');
          if (!name) throw new Error('name is required');
          if (chunkIndex === undefined || totalChunks === undefined)
            throw new Error('chunkIndex and totalChunks are required');
          if (!chunkBase64) throw new Error('chunkBase64 is required');

          let session = chunkUploadSessions.get(uploadId);
          if (!session) {
            session = {
              userId: ctx.userId,
              name,
              mimeType: mimeType || getMimeTypeFromFileName(name),
              folderId,
              totalChunks: Number(totalChunks),
              chunks: new Array(Number(totalChunks)),
              receivedCount: 0,
              lastActive: Date.now(),
            };
            chunkUploadSessions.set(uploadId, session);
          }

          session.lastActive = Date.now();
          const idx = Number(chunkIndex);
          if (!session.chunks[idx]) {
            let clean = String(chunkBase64).trim().replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
            session.chunks[idx] = Buffer.from(clean, 'base64');
            session.receivedCount++;
          }

          if (session.receivedCount < session.totalChunks) {
            return jsonResult({
              success: true,
              uploadId,
              chunkIndex: idx,
              totalChunks: session.totalChunks,
              receivedChunks: session.receivedCount,
              progress: `${Math.round((session.receivedCount / session.totalChunks) * 100)}%`,
              message: `Chunk ${idx + 1}/${session.totalChunks} received. Send remaining chunks to complete upload.`,
            });
          }

          // All chunks received! Stitch and upload
          const fullBuffer = Buffer.concat(session.chunks);
          chunkUploadSessions.delete(uploadId);

          const usedBytes = await getUserStorageUsage(ctx.userId);
          if (usedBytes + fullBuffer.length > QUOTA_LIMIT) {
            return jsonResult(
              {
                success: false,
                error: `Storage quota exceeded. Currently using ${formatBytes(usedBytes)} / 5 GB limit.`,
              },
              true
            );
          }

          // Resolve folder
          let resolvedFolderId = null;
          let resolvedFolderName = 'Root';
          if (session.folderId && session.folderId !== 'root') {
            if (session.folderId.match(/^[0-9a-fA-F]{24}$/)) {
              const folderDoc = await DriveFolder.findOne({ _id: session.folderId, user: ctx.userId });
              if (folderDoc) {
                resolvedFolderId = folderDoc._id;
                resolvedFolderName = folderDoc.name;
              }
            } else {
              let folderDoc = await DriveFolder.findOne({
                name: session.folderId,
                user: ctx.userId,
                isTrash: false,
              });
              if (!folderDoc) {
                folderDoc = await DriveFolder.create({ user: ctx.userId, name: session.folderId });
              }
              resolvedFolderId = folderDoc._id;
              resolvedFolderName = folderDoc.name;
            }
          }

          const randomHex = crypto.randomBytes(8).toString('hex');
          const safeName = session.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const r2Key = `users/${ctx.userId}/${randomHex}-${safeName}`;

          const r2 = getR2Client();
          if (!r2) {
            throw new Error('Cloud storage (Cloudflare R2) is not configured.');
          }

          await r2.send(
            new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: r2Key,
              Body: fullBuffer,
              ContentType: session.mimeType,
            })
          );

          const driveFile = await DriveFile.create({
            user: ctx.userId,
            folder: resolvedFolderId,
            name: session.name,
            size: fullBuffer.length,
            mimeType: session.mimeType,
            r2Key,
          });

          let previewUrl = '';
          try {
            const getCmd = new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: r2Key,
              ResponseContentDisposition: `inline; filename="${driveFile.name}"`,
            });
            previewUrl = await getSignedUrl(r2, getCmd, { expiresIn: 86400 });
          } catch (err) {}

          return jsonResult({
            success: true,
            message: `Successfully assembled all chunks and uploaded '${driveFile.name}' (${formatBytes(
              driveFile.size
            )}) into DayToDay Drive (${resolvedFolderName}).`,
            file: {
              id: driveFile._id,
              name: driveFile.name,
              size: driveFile.size,
              sizeFormatted: formatBytes(driveFile.size),
              mimeType: driveFile.mimeType,
              folder: resolvedFolderName,
              previewUrl,
              createdAt: driveFile.createdAt,
            },
          });
        }

        case 'finalize_file_upload': {
          const { fileId, size } = args || {};
          if (!fileId) throw new Error('fileId is required');

          const driveFile = await DriveFile.findOne({ _id: fileId, user: ctx.userId });
          if (!driveFile) {
            return jsonResult({ success: false, error: 'File record not found.' }, true);
          }

          if (size && Number(size) > 0) {
            driveFile.size = Number(size);
            await driveFile.save();
          }

          const r2 = getR2Client();
          let previewUrl = '';
          if (r2) {
            try {
              const getCmd = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: driveFile.r2Key,
                ResponseContentDisposition: `inline; filename="${driveFile.name}"`,
              });
              previewUrl = await getSignedUrl(r2, getCmd, { expiresIn: 86400 });
            } catch {}
          }

          return jsonResult({
            success: true,
            message: `File '${driveFile.name}' finalized successfully.`,
            file: {
              id: driveFile._id,
              name: driveFile.name,
              size: driveFile.size,
              sizeFormatted: formatBytes(driveFile.size),
              mimeType: driveFile.mimeType,
              previewUrl,
            },
          });
        }

        case 'upload_file':
        case 'upload_drive_file': {
          const {
            name,
            fileName,
            filename,
            contentBase64,
            file_base64,
            base64,
            content,
            textContent,
            text,
            sourceUrl,
            url,
            mimeType,
            contentType,
            folderId,
            folder_id,
            folder,
          } = args || {};

          const rawName = name || fileName || filename || 'uploaded_document';
          const targetFolderParam = folderId || folder_id || folder;
          const userMime = mimeType || contentType;

          // 1. Resolve file buffer and MIME type
          let buffer = null;
          let detectedMimeType = userMime || getMimeTypeFromFileName(rawName);

          let inputBase64 = contentBase64 || file_base64 || base64;
          if (!inputBase64 && typeof content === 'string') {
            // Check if content is base64 or text
            if (content.startsWith('data:') || /^[A-Za-z0-9+/=\s\r\n]{50,}$/.test(content.trim())) {
              inputBase64 = content;
            }
          }

          if (inputBase64) {
            let cleanB64 = String(inputBase64).trim();
            if (cleanB64.startsWith('data:')) {
              const matches = cleanB64.match(/^data:([^;]+);base64,(.+)$/s);
              if (matches) {
                if (!userMime) detectedMimeType = matches[1];
                cleanB64 = matches[2];
              } else {
                cleanB64 = cleanB64.replace(/^data:[^;]+;base64,/, '');
              }
            }
            cleanB64 = cleanB64.replace(/\s+/g, '');
            buffer = Buffer.from(cleanB64, 'base64');
          } else if (textContent !== undefined || text !== undefined) {
            const rawText = textContent !== undefined ? textContent : text;
            buffer = Buffer.from(String(rawText), 'utf8');
            if (!userMime && !rawName.includes('.')) {
              detectedMimeType = 'text/plain';
            }
          } else if (sourceUrl || url) {
            const fetchUrl = sourceUrl || url;
            const res = await fetch(fetchUrl);
            if (!res.ok) {
              throw new Error(`Failed to fetch file from URL (${res.status} ${res.statusText})`);
            }
            if (!userMime && res.headers.get('content-type')) {
              detectedMimeType = res.headers.get('content-type').split(';')[0];
            }
            const arrayBuf = await res.arrayBuffer();
            buffer = Buffer.from(arrayBuf);
          } else if (typeof content === 'string') {
            buffer = Buffer.from(content, 'utf8');
          }

          if (!buffer || buffer.length === 0) {
            return jsonResult(
              {
                success: false,
                error:
                  'No file content provided. Please pass contentBase64 (for binary files/PDFs), textContent (for text/markdown), or sourceUrl.',
              },
              true
            );
          }

          // 2. Check storage quota
          const usedBytes = await getUserStorageUsage(ctx.userId);
          if (usedBytes + buffer.length > QUOTA_LIMIT) {
            return jsonResult(
              {
                success: false,
                error: `Storage quota exceeded. Currently using ${formatBytes(usedBytes)} / 5 GB limit.`,
              },
              true
            );
          }

          // 3. Resolve parent folder
          let resolvedFolderId = null;
          let resolvedFolderName = 'Root';
          if (targetFolderParam && targetFolderParam !== 'root') {
            if (targetFolderParam.match(/^[0-9a-fA-F]{24}$/)) {
              const folderDoc = await DriveFolder.findOne({ _id: targetFolderParam, user: ctx.userId });
              if (folderDoc) {
                resolvedFolderId = folderDoc._id;
                resolvedFolderName = folderDoc.name;
              }
            } else {
              // Search folder by name or create it
              let folderDoc = await DriveFolder.findOne({
                name: targetFolderParam,
                user: ctx.userId,
                isTrash: false,
              });
              if (!folderDoc) {
                folderDoc = await DriveFolder.create({
                  user: ctx.userId,
                  name: targetFolderParam,
                });
              }
              resolvedFolderId = folderDoc._id;
              resolvedFolderName = folderDoc.name;
            }
          }

          // 4. Generate unique cloud storage R2/S3 key
          const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
          const randomHex = crypto.randomBytes(8).toString('hex');
          const r2Key = `users/${ctx.userId}/${randomHex}-${safeName}`;

          const r2 = getR2Client();
          if (!r2) {
            throw new Error('Cloud storage (Cloudflare R2 / S3) is not configured on this server.');
          }

          await r2.send(
            new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: r2Key,
              Body: buffer,
              ContentType: detectedMimeType,
            })
          );

          // 5. Save metadata into MongoDB
          const driveFile = await DriveFile.create({
            user: ctx.userId,
            folder: resolvedFolderId,
            name: rawName,
            size: buffer.length,
            mimeType: detectedMimeType,
            r2Key,
          });

          // 6. Generate presigned download preview URL (valid 24 hours)
          let previewUrl = '';
          try {
            const getCmd = new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: r2Key,
              ResponseContentDisposition: `inline; filename="${driveFile.name}"`,
            });
            previewUrl = await getSignedUrl(r2, getCmd, { expiresIn: 86400 });
          } catch (err) {
            console.error('Presigned preview URL generation error:', err);
          }

          return jsonResult({
            success: true,
            message: `Successfully uploaded '${driveFile.name}' (${formatBytes(driveFile.size)}) into DayToDay Drive (${resolvedFolderName}).`,
            file: {
              id: driveFile._id,
              name: driveFile.name,
              size: driveFile.size,
              sizeFormatted: formatBytes(driveFile.size),
              mimeType: driveFile.mimeType,
              folder: resolvedFolderName,
              folderId: resolvedFolderId || 'root',
              previewUrl,
              createdAt: driveFile.createdAt,
            },
          });
        }

        // -------------------------------------------------------------------
        // 3. Vault & Password Management
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

        case 'list_passwords': {
          const { master_password, type, query: searchQuery } = args || {};
          const settings = await VaultSettings.findOne({ user: ctx.userId });
          if (!settings) {
            return jsonResult({
              status: 'vault_not_initialized',
              message: 'The user has not initialized their DayToDay Vault yet.',
            });
          }

          const filter = { user: ctx.userId };
          if (type && type !== 'all') filter.type = type;
          const items = await VaultItem.find(filter).sort({ updatedAt: -1 });

          // If no master password provided, prompt the AI agent to ask the user
          if (!master_password) {
            return jsonResult({
              status: 'requires_master_password',
              message: 'Master password is required to decrypt and view account names, usernames, and details.',
              action_required: 'Please prompt the user for their DayToDay Master Password to view these accounts.',
              totalEncryptedItems: items.length,
              items: items.map((i) => ({
                id: i._id,
                type: i.type,
                isFavorite: i.isFavorite,
                updatedAt: i.updatedAt,
              })),
            });
          }

          // Verify master password
          const key = deriveVaultKeySync(master_password, settings.salt);
          const isValidKey = verifyVaultKey(key, settings.verifier, settings.verifierIv);
          if (!isValidKey) {
            return jsonResult(
              {
                status: 'invalid_master_password',
                error: 'The provided Master Password is incorrect. Please ask the user to verify their Master Password.',
              },
              true
            );
          }

          const decryptedList = [];
          for (const item of items) {
            try {
              const data = decryptVaultBlobSync(item.encryptedData, item.iv, key);
              const title = data.title || 'Untitled';
              const usernameField = data.fields?.find(
                (f) =>
                  f.type === 'email' ||
                  f.label?.toLowerCase().includes('username') ||
                  f.label?.toLowerCase().includes('email') ||
                  f.label?.toLowerCase().includes('account')
              );
              const websiteField = data.fields?.find(
                (f) => f.type === 'url' || f.label?.toLowerCase().includes('url') || f.label?.toLowerCase().includes('website')
              );

              const summaryItem = {
                id: item._id,
                type: item.type,
                title,
                username: usernameField?.value || data.username || '',
                website: websiteField?.value || data.website || '',
                notesSnippet: data.notes ? data.notes.slice(0, 40) : '',
                fieldCount: data.fields?.length || 0,
                isFavorite: item.isFavorite,
                updatedAt: item.updatedAt,
              };

              if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matches =
                  summaryItem.title.toLowerCase().includes(q) ||
                  summaryItem.username.toLowerCase().includes(q) ||
                  summaryItem.website.toLowerCase().includes(q) ||
                  summaryItem.type.toLowerCase().includes(q);
                if (!matches) continue;
              }

              decryptedList.push(summaryItem);
            } catch (err) {
              decryptedList.push({
                id: item._id,
                type: item.type,
                title: '[Decryption Error]',
                isFavorite: item.isFavorite,
                updatedAt: item.updatedAt,
              });
            }
          }

          return jsonResult({
            count: decryptedList.length,
            items: decryptedList,
            hint: 'To reveal full secret credentials or passwords for an item, call get_password with the item id.',
          });
        }

        case 'get_password': {
          const { id, master_password } = args || {};
          if (!id) throw new Error('Vault item ID (or title) is required.');

          const settings = await VaultSettings.findOne({ user: ctx.userId });
          if (!settings) {
            return jsonResult({
              status: 'vault_not_initialized',
              message: 'The user has not initialized their DayToDay Vault yet.',
            });
          }

          if (!master_password) {
            return jsonResult({
              status: 'requires_master_password',
              message: `To view and decrypt credential '${id}', please prompt the user for their DayToDay Master Password.`,
              action_required: 'Ask the user: "Please provide your DayToDay Master Password to unlock and view this credential."',
            });
          }

          const key = deriveVaultKeySync(master_password, settings.salt);
          const isValidKey = verifyVaultKey(key, settings.verifier, settings.verifierIv);
          if (!isValidKey) {
            return jsonResult(
              {
                status: 'invalid_master_password',
                error: 'The provided Master Password is incorrect. Please ask the user to verify their Master Password.',
              },
              true
            );
          }

          let item = null;
          // Try finding by ObjectId first
          if (id.match(/^[0-9a-fA-F]{24}$/)) {
            item = await VaultItem.findOne({ _id: id, user: ctx.userId });
          }

          // If not found by ID, search through decrypted items by title match
          if (!item) {
            const allItems = await VaultItem.find({ user: ctx.userId });
            for (const candidate of allItems) {
              try {
                const dec = decryptVaultBlobSync(candidate.encryptedData, candidate.iv, key);
                if (dec.title?.toLowerCase() === id.toLowerCase()) {
                  item = candidate;
                  break;
                }
              } catch {}
            }
          }

          if (!item) {
            return jsonResult(
              { success: false, error: `Vault item '${id}' was not found in user vault.` },
              true
            );
          }

          const decryptedData = decryptVaultBlobSync(item.encryptedData, item.iv, key);

          // Extract standard login fields for convenience
          const passField = decryptedData.fields?.find(
            (f) => f.type === 'password' || f.label?.toLowerCase().includes('password') || f.label?.toLowerCase().includes('pin')
          );
          const userField = decryptedData.fields?.find(
            (f) =>
              f.type === 'email' ||
              f.label?.toLowerCase().includes('username') ||
              f.label?.toLowerCase().includes('email') ||
              f.label?.toLowerCase().includes('account')
          );
          const urlField = decryptedData.fields?.find(
            (f) => f.type === 'url' || f.label?.toLowerCase().includes('url') || f.label?.toLowerCase().includes('website')
          );

          return jsonResult({
            success: true,
            id: item._id,
            type: item.type,
            title: decryptedData.title || 'Untitled',
            username: userField?.value || decryptedData.username || '',
            password: passField?.value || decryptedData.password || '',
            website: urlField?.value || decryptedData.website || '',
            notes: decryptedData.notes || '',
            fields: decryptedData.fields || [],
            tags: decryptedData.tags || [],
            isFavorite: item.isFavorite,
            updatedAt: item.updatedAt,
            createdAt: item.createdAt,
          });
        }

        case 'create_password': {
          const {
            title,
            type = 'website',
            username,
            password,
            website,
            notes,
            fields = [],
            isFavorite = false,
            master_password,
          } = args || {};

          if (!title) throw new Error('title is required');
          if (!password) throw new Error('password is required');
          if (!master_password) {
            return jsonResult({
              status: 'requires_master_password',
              message: `To encrypt and save '${title}', please prompt the user for their DayToDay Master Password.`,
              action_required: 'Ask the user for their DayToDay Master Password to encrypt and store this secret securely.',
            });
          }

          const settings = await VaultSettings.findOne({ user: ctx.userId });
          if (!settings) {
            return jsonResult({
              status: 'vault_not_initialized',
              message: 'The user has not initialized their DayToDay Vault yet.',
            });
          }

          const key = deriveVaultKeySync(master_password, settings.salt);
          const isValidKey = verifyVaultKey(key, settings.verifier, settings.verifierIv);
          if (!isValidKey) {
            return jsonResult(
              {
                status: 'invalid_master_password',
                error: 'The provided Master Password is incorrect. Please ask the user to verify their Master Password.',
              },
              true
            );
          }

          // Build fields list
          const assembledFields = Array.isArray(fields) ? [...fields] : [];
          if (type === 'website' || assembledFields.length === 0) {
            if (website && !assembledFields.some((f) => f.type === 'url' || f.label?.toLowerCase().includes('url'))) {
              assembledFields.unshift({ label: 'Website URL', value: website, type: 'url' });
            }
            if (username && !assembledFields.some((f) => f.type === 'text' || f.label?.toLowerCase().includes('username') || f.label?.toLowerCase().includes('email'))) {
              assembledFields.push({ label: 'Username/Email', value: username, type: 'text' });
            }
            if (password && !assembledFields.some((f) => f.type === 'password')) {
              assembledFields.push({ label: 'Password', value: password, type: 'password' });
            }
          }

          const payloadToEncrypt = {
            title,
            username: username || '',
            website: website || '',
            notes: notes || '',
            fields: assembledFields,
            tags: [],
          };

          const { encryptedData, iv } = encryptVaultBlobSync(payloadToEncrypt, key);

          const newItem = await VaultItem.create({
            user: ctx.userId,
            type: type || 'website',
            encryptedData,
            iv,
            isFavorite: Boolean(isFavorite),
          });

          return jsonResult({
            success: true,
            message: `Successfully created and encrypted credential '${title}' in DayToDay Vault.`,
            id: newItem._id,
            title,
            type: newItem.type,
            isFavorite: newItem.isFavorite,
            createdAt: newItem.createdAt,
          });
        }

        case 'update_password': {
          const {
            id,
            title,
            type,
            username,
            password,
            website,
            notes,
            fields,
            isFavorite,
            master_password,
          } = args || {};

          if (!id) throw new Error('Vault Item id is required');
          if (!master_password) {
            return jsonResult({
              status: 'requires_master_password',
              message: `To update vault item '${id}', please prompt the user for their DayToDay Master Password.`,
              action_required: 'Ask the user: "Please provide your DayToDay Master Password to authenticate this update."',
            });
          }

          const settings = await VaultSettings.findOne({ user: ctx.userId });
          if (!settings) {
            return jsonResult({
              status: 'vault_not_initialized',
              message: 'The user has not initialized their DayToDay Vault yet.',
            });
          }

          const key = deriveVaultKeySync(master_password, settings.salt);
          const isValidKey = verifyVaultKey(key, settings.verifier, settings.verifierIv);
          if (!isValidKey) {
            return jsonResult(
              {
                status: 'invalid_master_password',
                error: 'The provided Master Password is incorrect. Please ask the user to verify their Master Password.',
              },
              true
            );
          }

          const item = await VaultItem.findOne({ _id: id, user: ctx.userId });
          if (!item) {
            return jsonResult({ success: false, error: 'Vault item not found.' }, true);
          }

          // Decrypt existing data first
          const currentData = decryptVaultBlobSync(item.encryptedData, item.iv, key);

          // Update fields
          const updatedPayload = {
            title: title !== undefined ? title : currentData.title,
            username: username !== undefined ? username : currentData.username,
            website: website !== undefined ? website : currentData.website,
            notes: notes !== undefined ? notes : currentData.notes,
            tags: currentData.tags || [],
            fields: fields !== undefined ? fields : [...(currentData.fields || [])],
          };

          // If password, username, or website was explicitly updated, sync inside fields array too
          if (password) {
            const passIndex = updatedPayload.fields.findIndex(
              (f) => f.type === 'password' || f.label?.toLowerCase().includes('password')
            );
            if (passIndex >= 0) {
              updatedPayload.fields[passIndex].value = password;
            } else {
              updatedPayload.fields.push({ label: 'Password', value: password, type: 'password' });
            }
          }

          if (username) {
            const uIndex = updatedPayload.fields.findIndex(
              (f) =>
                f.type === 'email' ||
                f.label?.toLowerCase().includes('username') ||
                f.label?.toLowerCase().includes('email')
            );
            if (uIndex >= 0) {
              updatedPayload.fields[uIndex].value = username;
            }
          }

          if (website) {
            const wIndex = updatedPayload.fields.findIndex(
              (f) => f.type === 'url' || f.label?.toLowerCase().includes('url') || f.label?.toLowerCase().includes('website')
            );
            if (wIndex >= 0) {
              updatedPayload.fields[wIndex].value = website;
            }
          }

          const { encryptedData, iv } = encryptVaultBlobSync(updatedPayload, key);

          if (type) item.type = type;
          if (isFavorite !== undefined) item.isFavorite = Boolean(isFavorite);
          item.encryptedData = encryptedData;
          item.iv = iv;
          item.updatedAt = Date.now();
          await item.save();

          return jsonResult({
            success: true,
            message: `Vault item '${updatedPayload.title}' was successfully updated.`,
            id: item._id,
            title: updatedPayload.title,
            type: item.type,
            isFavorite: item.isFavorite,
            updatedAt: item.updatedAt,
          });
        }

        case 'delete_vault_item': {
          const { id } = args || {};
          if (!id) throw new Error('Vault item ID is required.');

          const item = await VaultItem.findOneAndDelete({ _id: id, user: ctx.userId });
          if (!item) {
            return jsonResult({ success: false, error: 'Vault item not found.' }, true);
          }

          return jsonResult({
            success: true,
            message: 'Vault item deleted successfully.',
            id,
          });
        }

        case 'generate_password': {
          const {
            length = 20,
            includeUppercase = true,
            includeLowercase = true,
            includeNumbers = true,
            includeSymbols = true,
            avoidAmbiguous = false,
          } = args || {};

          const passLength = Math.max(8, Math.min(128, Number(length) || 20));
          let uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
          let lowercase = 'abcdefghijkmnopqrstuvwxyz';
          let numbers = '23456789';
          let symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

          if (!avoidAmbiguous) {
            uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            lowercase = 'abcdefghijklmnopqrstuvwxyz';
            numbers = '0123456789';
          }

          let charPool = '';
          const guaranteedChars = [];

          if (includeUppercase) {
            charPool += uppercase;
            guaranteedChars.push(uppercase[crypto.randomInt(uppercase.length)]);
          }
          if (includeLowercase) {
            charPool += lowercase;
            guaranteedChars.push(lowercase[crypto.randomInt(lowercase.length)]);
          }
          if (includeNumbers) {
            charPool += numbers;
            guaranteedChars.push(numbers[crypto.randomInt(numbers.length)]);
          }
          if (includeSymbols) {
            charPool += symbols;
            guaranteedChars.push(symbols[crypto.randomInt(symbols.length)]);
          }

          if (!charPool) {
            charPool = lowercase + numbers;
          }

          const remainingLength = passLength - guaranteedChars.length;
          const passwordArray = [...guaranteedChars];

          for (let i = 0; i < remainingLength; i++) {
            const randIndex = crypto.randomInt(charPool.length);
            passwordArray.push(charPool[randIndex]);
          }

          // Cryptographic shuffle (Fisher-Yates)
          for (let i = passwordArray.length - 1; i > 0; i--) {
            const j = crypto.randomInt(i + 1);
            [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
          }

          const generated = passwordArray.join('');
          return jsonResult({
            success: true,
            password: generated,
            length: generated.length,
            entropyBits: Math.round(generated.length * Math.log2(charPool.length)),
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

export async function handleDirectHttpUpload(req, res) {
  try {
    let userId = null;
    try {
      userId = await resolveUserId(req);
    } catch {
      return res
        .status(401)
        .json({ success: false, message: 'Unauthorized: invalid or missing token' });
    }

    const {
      name,
      fileName,
      filename,
      fileId,
      folderId,
      folder_id,
      folder,
      mimeType,
      contentType,
    } = req.query;
    const rawName = name || fileName || filename || 'uploaded_document';
    const detectedMimeType =
      mimeType ||
      contentType ||
      req.headers['content-type'] ||
      getMimeTypeFromFileName(rawName);

    let buffer = null;
    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (typeof req.body === 'string') {
      buffer = Buffer.from(req.body);
    } else if (req.body && typeof req.body === 'object' && req.body.contentBase64) {
      buffer = Buffer.from(
        req.body.contentBase64
          .replace(/^data:[^;]+;base64,/, '')
          .replace(/\s+/g, ''),
        'base64'
      );
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No file binary data received in request body.',
      });
    }

    const usedBytes = await getUserStorageUsage(userId);
    if (usedBytes + buffer.length > QUOTA_LIMIT) {
      return res
        .status(403)
        .json({ success: false, message: 'Storage quota exceeded (5 GB limit).' });
    }

    const r2 = getR2Client();
    if (!r2) {
      return res
        .status(500)
        .json({ success: false, message: 'Cloud storage is not configured.' });
    }

    let driveFile = null;
    if (fileId && fileId.match(/^[0-9a-fA-F]{24}$/)) {
      driveFile = await DriveFile.findOne({ _id: fileId, user: userId });
    }

    let r2Key;
    if (driveFile) {
      r2Key = driveFile.r2Key;
      driveFile.size = buffer.length;
      driveFile.mimeType = detectedMimeType;
      await driveFile.save();
    } else {
      const targetFolderParam = folderId || folder_id || folder;
      let resolvedFolderId = null;
      let resolvedFolderName = 'Root';
      if (targetFolderParam && targetFolderParam !== 'root') {
        if (targetFolderParam.match(/^[0-9a-fA-F]{24}$/)) {
          const folderDoc = await DriveFolder.findOne({
            _id: targetFolderParam,
            user: userId,
          });
          if (folderDoc) {
            resolvedFolderId = folderDoc._id;
            resolvedFolderName = folderDoc.name;
          }
        } else {
          let folderDoc = await DriveFolder.findOne({
            name: targetFolderParam,
            user: userId,
            isTrash: false,
          });
          if (!folderDoc) {
            folderDoc = await DriveFolder.create({
              user: userId,
              name: targetFolderParam,
            });
          }
          resolvedFolderId = folderDoc._id;
          resolvedFolderName = folderDoc.name;
        }
      }

      const randomHex = crypto.randomBytes(8).toString('hex');
      const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
      r2Key = `users/${userId}/${randomHex}-${safeName}`;

      driveFile = await DriveFile.create({
        user: userId,
        folder: resolvedFolderId,
        name: rawName,
        size: buffer.length,
        mimeType: detectedMimeType,
        r2Key,
      });
    }

    await r2.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: r2Key,
        Body: buffer,
        ContentType: detectedMimeType,
      })
    );

    let previewUrl = '';
    try {
      const getCmd = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: r2Key,
        ResponseContentDisposition: `inline; filename="${driveFile.name}"`,
      });
      previewUrl = await getSignedUrl(r2, getCmd, { expiresIn: 86400 });
    } catch {}

    return res.status(200).json({
      success: true,
      message: `File '${driveFile.name}' (${formatBytes(
        driveFile.size
      )}) successfully uploaded to DayToDay Drive.`,
      file: {
        id: driveFile._id,
        name: driveFile.name,
        size: driveFile.size,
        sizeFormatted: formatBytes(driveFile.size),
        mimeType: driveFile.mimeType,
        previewUrl,
        createdAt: driveFile.createdAt,
      },
    });
  } catch (err) {
    console.error('Direct HTTP upload error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export { buildServer };
