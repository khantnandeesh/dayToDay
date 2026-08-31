import crypto from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildServer, resolveUserId } from './server.js';

const sessions = new Map();
const MAX_SESSIONS = 1000;

const getResourceMetadataUrl = (req) => {
  const base = process.env.MCP_PUBLIC_URL || 'https://' + req.headers.host;
  return base + '/.well-known/oauth-protected-resource';
};

const sendUnauthorized = (req, res) => {
  res.setHeader('WWW-Authenticate', 'Bearer resource_metadata=\"' + getResourceMetadataUrl(req) + '\", scope=\"mcp\"');
  return res.status(401).json({ success: false, message: 'Unauthorized' });
};

// Standard MCP Streamable HTTP handler. The first authenticated POST creates
// a session; follow-up requests must use the same session and user.
export async function handleStreamableMcp(req, res) {
  let userId;
  try {
    userId = await resolveUserId(req);
  } catch {
    return sendUnauthorized(req, res);
  }

  const sessionId = req.get('Mcp-Session-Id');
  let entry = sessionId ? sessions.get(sessionId) : undefined;

  if (sessionId && !entry) {
    return res.status(404).json({ success: false, message: 'Unknown or expired MCP session' });
  }

  try {
    if (!entry) {
      if (req.method !== 'POST') {
        return res.status(400).json({ success: false, message: 'Initialize with POST /mcp first' });
      }
      if (sessions.size >= MAX_SESSIONS) {
        return res.status(503).json({ success: false, message: 'MCP session capacity reached' });
      }

      const ctx = { userId };
      const server = buildServer(ctx);
      let transport;
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (newSessionId) => {
          sessions.set(newSessionId, { transport, server, ctx, userId: String(userId) });
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };

      await server.connect(transport);
      return await transport.handleRequest(req, res, req.body);
    }

    if (entry.userId !== String(userId)) {
      return res.status(403).json({ success: false, message: 'MCP session belongs to another user' });
    }

    entry.ctx.userId = userId;
    return await entry.transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Streamable MCP error:', error);
    if (!res.headersSent) return res.status(500).json({ success: false, message: 'MCP transport error' });
  }
}
