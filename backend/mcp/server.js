import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Session from '../models/Session.js';
import McpOAuthClient from '../models/McpOAuthClient.js';

// Holds active SSE transports keyed by MCP sessionId so the POST
// /mcp/messages endpoint can route client messages to the right server.
export const mcpTransports = new Map();

// ---------------------------------------------------------------------------
// MCP authentication
// ---------------------------------------------------------------------------
// Reuses the same JWT + active-session contract as your `protect` middleware,
// but ALSO accepts the token via `?token=` query string or cookie. This is
// required because the browser `EventSource` API cannot set request headers,
// so a Bearer header is impossible for the initial SSE GET from a browser.
// Server-to-server / Gemini clients can still send `Authorization: Bearer`.
export async function authenticateMcpRequest(req, res, next) {
  let token =
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer')
      ? req.headers.authorization.split(' ')[1]
      : null) ||
    req.query.token ||
    req.cookies?.token;

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: 'Unauthorized: missing token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let user;
    if (decoded.mcp) {
      // OAuth-issued access token (Gemini / custom connected apps).
      // No Session document exists for these; identity is the signed `id`.
      user = await User.findById(decoded.id).select(
        '-password -twoFactorCode -twoFactorCodeExpires'
      );
    } else {
      // Enforce an active, non-expired session (mirrors middleware/auth.js).
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
    return res
      .status(401)
      .json({ success: false, message: 'Unauthorized' });
  }
}

// Resolve the authenticated user id from a request (Bearer header / cookie / ?token).
// Throws if missing or invalid. Supports both session JWTs and OAuth `mcp` tokens.
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
// OAuth 2.0 (client_credentials) — for Gemini "custom connected apps".
// Gemini discovers this via /.well-known/oauth-authorization-server, then POSTs
// client_id + client_secret to /oauth/token and receives a user-scoped JWT.
// ---------------------------------------------------------------------------
export function oauthMetadata(req, res) {
  // This must be the public backend origin that Gemini can reach over HTTPS.
  const base = process.env.MCP_PUBLIC_URL || ('https://' + req.headers.host);
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
// Gemini redirects the user's browser here; we authenticate the user (reusing
// an existing session cookie if present, otherwise a minimal login form) and
// redirect back to Google's redirect_uri with a short-lived `code`. The code is
// a signed JWT (no server-side state needed, works across Heroku dynos).
// ---------------------------------------------------------------------------
function renderLoginForm(params) {
  const hidden = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${String(v).replace(/"/g, '&quot;')}">`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Authorize DayToDay MCP</title>
  <style>body{font-family:system-ui,sans-serif;background:#f5f5f5;display:flex;min-height:100vh;align-items:center;justify-content:center}
  .card{background:#fff;padding:32px 28px;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.08);width:340px}
  h1{font-size:18px;margin:0 0 4px} p{color:#666;font-size:13px;margin:0 0 20px}
  input{width:100%;padding:10px 12px;margin-bottom:12px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box}
  button{width:100%;padding:11px;background:#111;color:#fff;border:0;border-radius:8px;font-weight:600;cursor:pointer}
  .muted{font-size:11px;color:#999;margin-top:14px}</style></head>
  <body><form class="card" method="post">
    <h1>Connect DayToDay to Gemini</h1>
    <p>Sign in to grant Gemini access to your account.</p>
    ${hidden}
    <input name="email" type="email" placeholder="Email" autocomplete="username" required>
    <input name="password" type="password" placeholder="Password" autocomplete="current-password" required>
    <button type="submit">Authorize</button>
    <div class="muted">DayToDay Secure Vault &bull; MCP OAuth</div>
  </form></body></html>`;
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

  const { email, password } = req.body || {};
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    res.status(401).setHeader('Content-Type', 'text/html');
    return res.send(
      renderLoginForm({ ...q, error: '1' }) +
        '<p style="color:#c00;font-size:12px">Invalid email or password.</p>'
    );
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
    return res.redirect(url.toString());
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

// Build a fresh MCP Server. `ctx` is a mutable per-connection object
// ({ userId: null }). The server is connected on the (possibly anonymous) SSE
// GET so the endpoint event is emitted; the real user is bound by setting
// ctx.userId on the first authenticated POST /mcp/messages. Every tool call is
// therefore inherently scoped to that user.
function buildServer(ctx) {
  const server = new Server(
    { name: 'daytoday-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  const tools = [
    {
      name: 'get_security_profile',
      description:
        "Retrieve the authenticated user's basic profile and 2FA enablement status. Never returns passwords or 2FA secrets.",
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'list_active_devices',
      description:
        'List all active sessions/devices for the authenticated user, including IP, OS, browser and expiration.',
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
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Tools require an authenticated, bound user.
    if (!ctx.userId) {
      return jsonResult(
        { success: false, error: 'Not authenticated' },
        true
      );
    }

    try {
      switch (name) {
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

        // -------------------------------------------------------------------
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

        // -------------------------------------------------------------------
        case 'revoke_device_session': {
          const { sessionId } = args || {};
          if (!sessionId) throw new Error('sessionId is required');

          // Ownership enforced by filtering on userId.
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

          // Keep the user's trusted-device list in sync.
          const u = await User.findById(ctx.userId);
          if (u && u.devices?.some((d) => d.deviceId === session.deviceId)) {
            u.devices = u.devices.filter(
              (d) => d.deviceId !== session.deviceId
            );
            await u.save();
          }

          return jsonResult({
            success: true,
            message: 'Device session revoked.',
            sessionId,
          });
        }

        // -------------------------------------------------------------------
        case 'get_account_audit_log': {
          const u = await User
            .findById(ctx.userId)
            .select('devices');
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
            note: 'No dedicated audit-log collection exists; this is derived from device history and active sessions.',
            recentDevices,
            activeSessions: activeSessions.map((s) => ({
              sessionId: s._id,
              ...s.deviceInfo,
              createdAt: s.createdAt,
              expiresAt: s.expiresAt,
            })),
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
