#!/usr/bin/env node

const base = (process.env.MCP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const bearer = process.env.MCP_TEST_BEARER;
const fail = (message) => { console.error('FAIL: ' + message); process.exitCode = 1; };

const request = async (path, init = {}, readStream = false) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(base + path, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/event-stream',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}),
        ...(init.headers || {}),
      },
    });
    let body = '';
    if (readStream && response.body) {
      const reader = response.body.getReader();
      const first = await Promise.race([
        reader.read(),
        new Promise((resolve) => setTimeout(() => resolve({}), 5000)),
      ]);
      body = first.value ? new TextDecoder().decode(first.value) : '';
    } else {
      body = await response.text();
    }
    return {
      status: response.status,
      headers: response.headers,
      contentType: response.headers.get('content-type') || '',
      wwwAuthenticate: response.headers.get('www-authenticate') || '',
      corsOrigin: response.headers.get('access-control-allow-origin') || '',
      corsHeaders: response.headers.get('access-control-allow-headers') || '',
      corsExpose: response.headers.get('access-control-expose-headers') || '',
      body,
    };
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
};

console.log('Testing MCP Server at ' + base + '...\n');

// 1. OAuth Authorization Server Metadata
const metadata = await request('/.well-known/oauth-authorization-server');
if (metadata.status !== 200) fail('OAuth authorization metadata returned ' + metadata.status);
let metadataJson;
try {
  metadataJson = JSON.parse(metadata.body);
} catch {
  fail('OAuth authorization metadata was not JSON');
}
if (!metadataJson?.registration_endpoint) fail('OAuth metadata is missing registration_endpoint');
if (!metadataJson?.token_endpoint) fail('OAuth metadata is missing token_endpoint');

// 2. OpenID Configuration Alias
const oidc = await request('/.well-known/openid-configuration');
if (oidc.status !== 200) fail('OpenID configuration endpoint returned ' + oidc.status);

// 3. OAuth Protected Resource Metadata
const resource = await request('/.well-known/oauth-protected-resource');
if (resource.status !== 200) fail('Protected-resource metadata returned ' + resource.status);
let resourceJson;
try {
  resourceJson = JSON.parse(resource.body);
} catch {
  fail('Protected-resource metadata was not JSON');
}
if (!resourceJson?.authorization_servers?.length) fail('Protected-resource metadata is missing authorization_servers');

// 4. Path-specific Protected Resource Metadata
const resourceSubpath = await request('/.well-known/oauth-protected-resource/mcp');
if (resourceSubpath.status !== 200) fail('Protected-resource /mcp subpath returned ' + resourceSubpath.status);

// 5. CORS Preflight (OPTIONS /mcp)
const preflight = await request('/mcp', {
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://gemini.google.com',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'authorization,content-type,mcp-session-id',
  },
});
if (preflight.status !== 204 && preflight.status !== 200) {
  fail('CORS preflight OPTIONS /mcp returned ' + preflight.status);
}
if (!preflight.corsOrigin) fail('CORS preflight missing Access-Control-Allow-Origin header');

// 6. Streamable HTTP (/mcp)
const standard = await request('/mcp', {
  method: 'POST',
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'daytoday-compatibility-test', version: '2.0.0' },
    },
  }),
});
if (bearer && (standard.status < 200 || standard.status >= 300)) {
  fail('Authenticated /mcp initialize returned ' + standard.status + ': ' + standard.body.slice(0, 300));
}
if (!bearer && standard.status !== 401) {
  fail('Unauthenticated /mcp should return 401, got ' + standard.status);
}
if (!bearer && standard.status === 401 && !standard.wwwAuthenticate) {
  fail('Unauthenticated /mcp is missing WWW-Authenticate header');
}

// 7. Legacy SSE (/mcp/sse)
const legacy = await request('/mcp/sse', {}, true);
if (legacy.status !== 200 || !legacy.contentType.includes('text/event-stream')) {
  fail('Legacy SSE returned ' + legacy.status + ' / ' + legacy.contentType);
}
if (legacy.status === 200 && !legacy.body.includes('/mcp/messages?sessionId=')) {
  fail('Legacy SSE did not advertise a message endpoint');
}

// 8. Health Endpoint
const health = await request('/health');
if (health.status !== 200) fail('/health returned status ' + health.status);

if (process.exitCode) {
  console.error('\n❌ One or more MCP compatibility checks failed.');
  process.exit(process.exitCode);
} else {
  console.log('\n✅ All MCP compatibility tests passed successfully for ' + base + (bearer ? ' with bearer auth' : ' in discovery mode'));
}
