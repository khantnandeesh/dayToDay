#!/usr/bin/env node

const base = (process.env.MCP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const bearer = process.env.MCP_TEST_BEARER;
const fail = (message) => { console.error('FAIL: ' + message); process.exitCode = 1; };

const request = async (path, init = {}) => {
  const response = await fetch(base + path, {
    ...init,
    headers: {
      Accept: 'application/json, text/event-stream',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}),
      ...(init.headers || {}),
    },
  });
  return { status: response.status, contentType: response.headers.get('content-type') || '', wwwAuthenticate: response.headers.get('www-authenticate') || '', body: await response.text() };
};

const metadata = await request('/.well-known/oauth-authorization-server');
if (metadata.status !== 200) fail('OAuth authorization metadata returned ' + metadata.status);

const resource = await request('/.well-known/oauth-protected-resource');
if (resource.status !== 200) fail('Protected-resource metadata returned ' + resource.status);

const standard = await request('/mcp', {
  method: 'POST',
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'daytoday-compatibility-test', version: '1.0.0' } } }),
});
if (bearer && (standard.status < 200 || standard.status >= 300)) fail('Authenticated /mcp initialize returned ' + standard.status + ': ' + standard.body.slice(0, 300));
if (!bearer && standard.status !== 401) fail('Unauthenticated /mcp should return 401, got ' + standard.status);
if (!bearer && standard.status === 401 && !standard.wwwAuthenticate) fail('Unauthenticated /mcp is missing WWW-Authenticate');

const legacy = await request('/mcp/sse');
if (legacy.status !== 200 || !legacy.contentType.includes('text/event-stream')) fail('Legacy SSE returned ' + legacy.status + ' / ' + legacy.contentType);
if (legacy.status === 200 && !legacy.body.includes('/mcp/messages?sessionId=')) fail('Legacy SSE did not advertise a message endpoint');

if (process.exitCode) process.exit(process.exitCode);
console.log('MCP compatibility smoke test passed for ' + base + (bearer ? ' with bearer auth' : ' in discovery mode'));
