import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import Session from '../models/Session.js';

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

// ---------------------------------------------------------------------------
// OAuth 2.0 (client_credentials) — for Gemini "custom connected apps".
// Gemini discovers this via /.well-known/oauth-authorization-server, then POSTs
// client_id + client_secret to /oauth/token and receives a user-scoped JWT.
// ---------------------------------------------------------------------------
export function oauthMetadata(req, res) {
  const base = process.env.BACKEND_URL || `https://${req.headers.host}`;
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    grant_types_supported: ['authorization_code', 'client_credentials'],
    token_endpoint_auth_methods_supported: [
      'client_secret_basic',
      'client_secret_post',
    ],
    response_types_supported: ['code'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['mcp'],
  });
}

// ---------------------------------------------------------------------------
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
  const q =
    req.method === 'POST'
      ? { ...req.query, ...req.body }
      : req.query;

  const {
    response_type,
    client_id,
    redirect_uri,
    state,
    code_challenge,
    code_challenge_method,
    scope,
  } = q;

  // Already authenticated via an active session cookie? Short-circuit.
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
          client_id,
          redirect_uri,
          state,
          code_challenge,
        });
      }
    } catch {
      /* fall through to login form */
    }
  }

  // GET without auth -> show login form.
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'text/html');
    return res.send(renderLoginForm(q));
  }

  // POST -> verify credentials, then issue code.
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
    client_id,
    redirect_uri,
    state,
    code_challenge,
  });
}

function finishAuthorize(res, userId, { client_id, redirect_uri, state, code_challenge }) {
  const code = jwt.sign(
    {
      sub: userId.toString(),
      azp: client_id,
      cch: code_challenge || null,
      typ: 'azc',
    },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );
  try {
    const url = new URL(redirect_uri);
    url.searchParams.set('code', code);
    if (state) url.searchParams.set('state', state);
    return res.redirect(url.toString());
  } catch {
    return res.status(400).json({ error: 'invalid_redirect_uri' });
  }
}

export async function oauthToken(req, res) {
  let clientId;
  let clientSecret;

  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    clientId = decoded.slice(0, idx);
    clientSecret = decoded.slice(idx + 1);
  } else {
    clientId = req.body?.client_id;
    clientSecret = req.body?.client_secret;
  }

  if (
    !process.env.MCP_CLIENT_ID ||
    !process.env.MCP_CLIENT_SECRET ||
    clientId !== process.env.MCP_CLIENT_ID ||
    clientSecret !== process.env.MCP_CLIENT_SECRET
  ) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  const grantType = req.body?.grant_type;

  // --- Authorization Code grant (Gemini's user-bound flow) ---
  if (grantType === 'authorization_code') {
    const code = req.body?.code;
    const verifier = req.body?.code_verifier;
    let cd;
    try {
      cd = jwt.verify(code, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ error: 'invalid_grant' });
    }
    if (cd.typ !== 'azc' || cd.azp !== clientId) {
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

  // --- Client Credentials grant (fixed service user) ---
  if (grantType === 'client_credentials') {
    const userId = process.env.MCP_OAUTH_USER_ID;
    if (!userId) {
      return res.status(500).json({ error: 'server_misconfigured' });
    }
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

// Build a fresh MCP Server scoped to a single authenticated user.
// The `userId` is closed over, so every tool call is inherently scoped.
function buildServer(userId) {
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

    try {
      switch (name) {
        // -------------------------------------------------------------------
        case 'get_security_profile': {
          const u = await User.findById(userId).select(
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
            userId,
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
            userId,
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
          const u = await User.findById(userId);
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
            .findById(userId)
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
            userId,
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
