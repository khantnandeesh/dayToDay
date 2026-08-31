import crypto from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildServer, resolveUserId, getPublicBaseUrl } from './server.js';

const sessions = new Map();
const MAX_SESSIONS = 1000;

const getResourceMetadataUrl = (req) => {
  const base = getPublicBaseUrl(req);
  return `${base}/.well-known/oauth-protected-resource`;
};

const sendUnauthorized = (req, res) => {
  const metaUrl = getResourceMetadataUrl(req);
  res.setHeader(
    'WWW-Authenticate',
    `Bearer resource_metadata="${metaUrl}", scope="mcp"`
  );
  return res.status(401).json({
    success: false,
    message: 'Unauthorized: Bearer token or OAuth authentication required',
    resource_metadata: metaUrl,
  });
};

// Standard MCP Streamable HTTP handler.
// The first authenticated request creates a session; follow-up requests use the same session.
export async function handleStreamableMcp(req, res) {
  let userId;
  try {
    userId = await resolveUserId(req);
  } catch {
    return sendUnauthorized(req, res);
  }

  const sessionId =
    req.get('Mcp-Session-Id') ||
    req.query.sessionId ||
    req.query.session_id;

  let entry = sessionId ? sessions.get(sessionId) : undefined;

  if (sessionId && !entry) {
    return res.status(404).json({
      success: false,
      message: 'Unknown or expired MCP session. Please re-initialize with POST /mcp',
    });
  }

  try {
    if (!entry) {
      if (req.method !== 'POST') {
        return res.status(400).json({
          success: false,
          message: 'Initialize MCP session with POST /mcp first',
        });
      }
      if (sessions.size >= MAX_SESSIONS) {
        return res.status(503).json({
          success: false,
          message: 'MCP session capacity reached. Try again later.',
        });
      }

      const ctx = { userId };
      const server = buildServer(ctx);
      let transport;
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (newSessionId) => {
          sessions.set(newSessionId, {
            transport,
            server,
            ctx,
            userId: String(userId),
            createdAt: Date.now(),
          });
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          sessions.delete(transport.sessionId);
        }
      };

      await server.connect(transport);
      return await transport.handleRequest(req, res, req.body);
    }

    // Validate that the request belongs to the authenticated user of this session
    if (entry.userId !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: 'MCP session belongs to another authenticated user',
      });
    }

    entry.ctx.userId = userId;
    return await entry.transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Streamable MCP error:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'MCP transport error: ' + (error.message || 'Unknown error'),
      });
    }
  }
}
