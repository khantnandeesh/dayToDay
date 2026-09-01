# AI Vault Session Security Improvements - Implementation Summary

## Overview
This implementation adds capability-based access control and secure temporary links to the DayToDay vault system, allowing AI assistants to access vault credentials without the user typing their master password in chat.

## Core Features Implemented

### 1. Capability-Based AI Vault Sessions
- **Granular Permissions**: Each session can have specific permissions (listItems, readMetadata, createSecureLink, revealSecret, etc.)
- **Item-Level Access Control**: Sessions can be restricted to specific vault items only
- **Persistent Sessions**: Sessions are stored in MongoDB with hashed tokens (not in-memory only)
- **Full Audit Trail**: All session creation and usage is logged

### 2. Secure Temporary Access Links
- **One-Time Use Links**: Links can be used once and then automatically expire
- **Time-Bound**: Links expire after a configurable duration (max 15 minutes)
- **Opaque Tokens**: URLs contain tokens, not passwords or sensitive data
- **Revocable**: Links can be manually revoked before expiration
- **Metadata Only**: Links return only safe metadata, never decrypted secrets

### 3. Secure Authorization Flow
1. AI requests authorization via `request_ai_vault_authorization`
2. User opens DayToDay web UI and enters master password
3. Frontend creates session via `/api/vault/ai-session/complete`
4. Session token returned to frontend (never logged or exposed to AI)
5. AI uses session token for subsequent vault operations

## New Database Models

### AIVaultSession
Stores capability-based sessions with:
- Hashed session tokens (SHA-256)
- Granular permissions object
- Optional item restrictions
- Expiration timestamps
- Revocation status

### VaultAccessLink
Stores temporary access links with:
- Hashed access tokens
- Linked vault item reference
- One-time use flag
- Usage tracking (usedAt)
- Session provenance

### VaultAuditLog
Comprehensive audit trail for:
- Session creation/revocation
- Link creation/usage/revocation
- Item access events
- All with metadata and timestamps

## New REST API Endpoints

### Session Management
```
POST /api/vault/ai-session/authorize
  - Initiates authorization flow (returns UI URL)

POST /api/vault/ai-session/complete
  - Completes authorization after user enters master password
  - Returns session token

GET /api/vault/ai-session/status
  - Lists active sessions

POST /api/vault/ai-session/revoke/:id
  - Revokes a specific session
```

### Access Link Management
```
POST /api/vault/access-link/create
  - Creates a temporary secure link
  - Params: itemId, expiresInSeconds, oneTimeUse

GET /api/vault/access-link/:token
  - Public endpoint to access item via link
  - Returns metadata only (no decrypted data)

POST /api/vault/access-link/revoke/:id
  - Manually revokes a link
```

### Audit
```
GET /api/vault/audit-log
  - Query: limit, offset, action filter
  - Returns paginated audit logs
```

## New MCP Tools

### request_ai_vault_authorization
Initiates the secure authorization flow without requiring master password in chat.
- Returns authorization URL for DayToDay web UI
- Specifies requested permissions and duration
- Guides user to complete authorization in browser

### get_ai_vault_session_info
Shows current session status including:
- Active sessions and their permissions
- Expiration times
- Item restrictions

### create_secure_vault_link
Creates a temporary access link for a specific vault item.
- Parameters: vaultItemId, expiresInMinutes (max 15), oneTimeUse
- Returns: URL with opaque token
- Validates permissions and item restrictions

### revoke_secure_vault_link
Manually invalidates a previously created link.
- Marks link as used immediately
- Prevents further access

### list_secure_vault_links
Lists all links created during the current session.
- Shows active and used links
- Includes expiration and usage status

### access_vault_item_via_link
Accesses a vault item using a link token.
- Validates token and expiration
- Returns metadata only (never decrypted passwords)
- Marks one-time links as used

## Security Improvements

### 1. Master Password Protection
- Master password NEVER passed to AI or logged
- User enters password only in DayToDay web UI
- Password used to derive encryption key, then discarded

### 2. Token Security
- All tokens hashed with SHA-256 before storage
- Raw tokens never stored in database
- Tokens have limited scope and lifetime

### 3. Permission Enforcement
- Every vault operation checks session permissions
- Item-level restrictions enforced
- Clear error messages for unauthorized access

### 4. Audit Trail
- All security events logged
- Links trace back to creating session
- Full visibility into AI access patterns

### 5. Backward Compatibility
- Legacy in-memory sessions still work
- Old `master_password` parameter still supported
- Gradual migration path for existing integrations

## Usage Example

### Scenario: AI needs to access Netflix password

**Old Flow (Insecure):**
1. User types: "Get my Netflix password"
2. AI asks: "What's your master password?"
3. User types master password in chat ❌
4. AI calls `get_password` with master password
5. Password returned to chat

**New Flow (Secure):**
1. User says: "Get my Netflix password"
2. AI calls `list_passwords` (no auth yet)
3. System responds: "Requires authorization"
4. AI calls `request_ai_vault_authorization`
5. AI shows user: "Please open this link to authorize"
6. User clicks link, enters master password in DayToDay UI ✓
7. User sees: "Session authorized for 30 minutes"
8. User returns to chat and says: "I've authorized it"
9. AI calls `list_passwords` (now works via active session)
10. AI finds Netflix item ID
11. AI calls `create_secure_vault_link` for Netflix
12. AI shows user: "Click this secure link to view your password"
13. User clicks link (one-time use, expires in 5 min)
14. User sees password in DayToDay UI (never in chat) ✓

## Files Modified/Created

### New Models
- `backend/models/AIVaultSession.js`
- `backend/models/VaultAccessLink.js`
- `backend/models/VaultAuditLog.js`

### Modified Files
- `backend/controllers/vaultController.js` - Added session and link management
- `backend/routes/vaultRoutes.js` - Added new REST endpoints
- `backend/mcp/server.js` - Added new MCP tools and handlers

## Testing Recommendations

1. **Authorization Flow**: Test complete flow from request to session creation
2. **Permission Enforcement**: Verify operations fail without proper permissions
3. **Link Lifecycle**: Test link creation, usage, expiration, and revocation
4. **One-Time Use**: Verify links can't be reused after first access
5. **Audit Logs**: Confirm all operations are properly logged
6. **Backward Compatibility**: Ensure old flows still work

## Migration Path

1. **Phase 1**: Deploy new models and endpoints (backward compatible)
2. **Phase 2**: Update AI clients to use new authorization flow
3. **Phase 3**: Deprecate `master_password` parameter in AI context
4. **Phase 4**: Make secure links the default for password retrieval

## Future Enhancements

1. **Session Scoping**: Allow users to pre-authorize specific items
2. **Usage Limits**: Add rate limiting per session
3. **Notifications**: Alert users when sessions are created/used
4. **Session History**: UI to view and manage all active sessions
5. **Selective Revocation**: Revoke specific permissions without full revocation

## Security Considerations

- All tokens use cryptographic randomness (crypto.randomBytes)
- Tokens are hashed before storage (SHA-256)
- Sessions have configurable expiration (default 30 min, max 120 min)
- Links have shorter expiration (max 15 min)
- One-time use is enforced at database level
- All operations validate user ownership
- Audit logs are append-only (no updates/deletes)

## Configuration

Environment variables used:
- `FRONTEND_URL` - Base URL for authorization and access links
- `BACKEND_URL` - Fallback if FRONTEND_URL not set
- Session duration limits enforced in code (not configurable via env)

## Compliance

This implementation follows security best practices:
- Principle of least privilege (granular permissions)
- Defense in depth (multiple validation layers)
- Audit accountability (comprehensive logging)
- Secure defaults (one-time use, short expiration)
- Clear separation of concerns (models, controllers, routes)
