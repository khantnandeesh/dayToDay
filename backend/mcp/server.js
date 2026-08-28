import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import jwt from 'jsonwebtoken';
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
    grant_types_supported: ['client_credentials'],
    token_endpoint_auth_methods_supported: [
      'client_secret_basic',
      'client_secret_post',
    ],
    response_types_supported: ['token'],
    scopes_supported: ['mcp'],
  });
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

  const userId = process.env.MCP_OAUTH_USER_ID;
  if (!userId) {
    return res.status(500).json({ error: 'server_misconfigured' });
  }

  // Mint a user-scoped JWT carrying the `mcp` claim so authenticateMcpRequest
  // can skip the (nonexistent) Session lookup for OAuth tokens.
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
