import crypto from 'crypto';
import VaultSettings from '../models/VaultSettings.js';
import VaultItem from '../models/VaultItem.js';
import AIVaultSession from '../models/AIVaultSession.js';
import VaultAccessLink from '../models/VaultAccessLink.js';
import VaultAuditLog from '../models/VaultAuditLog.js';
import {
  setMcpVaultSession,
  getMcpVaultSession,
  revokeMcpVaultSession,
  createMcpOneTimeToken,
  deriveVaultKeySync,
  verifyVaultKey,
  decryptVaultBlobSync,
} from '../mcp/server.js';

// Helper: hash a token for storage
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// @desc    Check if users vault is initialized
// @route   GET /api/vault/status
// @access  Private
export const getVaultStatus = async (req, res) => {
  try {
    const settings = await VaultSettings.findOne({ user: req.user._id });
    res.status(200).json({
      success: true,
      isInitialized: !!settings,
    });
  } catch (error) {
    console.error('Vault status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Initialize vault (Set Master Password)
// @route   POST /api/vault/init
// @access  Private
export const initializeVault = async (req, res) => {
  try {
    const { salt, verifier, verifierIv } = req.body;
    
    let settings = await VaultSettings.findOne({ user: req.user._id });
    if (settings) {
      return res.status(400).json({ success: false, message: 'Vault already initialized' });
    }

    settings = await VaultSettings.create({
      user: req.user._id,
      salt,
      verifier,
      verifierIv
    });

    res.status(201).json({
      success: true,
      message: 'Vault initialized successfully'
    });
  } catch (error) {
    console.error('Vault init error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get all vault items and settings (for local decryption)
// @route   GET /api/vault/sync
// @access  Private
export const getVaultData = async (req, res) => {
  try {
    const settings = await VaultSettings.findOne({ user: req.user._id });
    if (!settings) {
      return res.status(404).json({ success: false, message: 'Vault not initialized' });
    }

    const items = await VaultItem.find({ user: req.user._id }).sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      salt: settings.salt,
      verifier: settings.verifier,
      verifierIv: settings.verifierIv,
      customTemplates: settings.customTemplates || [],
      items: items.map(item => ({
        id: item._id,
        type: item.type,
        encryptedData: item.encryptedData,
        iv: item.iv,
        isFavorite: item.isFavorite,
        updatedAt: item.updatedAt
      }))
    });
  } catch (error) {
    console.error('Vault sync error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create or Update a vault item
// @route   POST /api/vault/items
// @access  Private
export const syncItem = async (req, res) => {
  try {
    const { id, type, encryptedData, iv, isFavorite } = req.body;

    let item;
    if (id) {
      // Update existing
      item = await VaultItem.findOne({ _id: id, user: req.user._id });
      if (!item) {
        return res.status(404).json({ success: false, message: 'Item not found' });
      }
      item.type = type || item.type;
      item.encryptedData = encryptedData;
      item.iv = iv;
      item.isFavorite = isFavorite !== undefined ? isFavorite : item.isFavorite;
      item.updatedAt = Date.now();
      await item.save();
    } else {
      // Create new
      item = await VaultItem.create({
        user: req.user._id,
        type,
        encryptedData,
        iv,
        isFavorite
      });
    }

    res.status(200).json({
      success: true,
      item: {
        id: item._id,
        type: item.type,
        encryptedData: item.encryptedData,
        iv: item.iv,
        isFavorite: item.isFavorite,
        updatedAt: item.updatedAt
      }
    });

  } catch (error) {
    console.error('Vault item sync error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete vault item
// @route   DELETE /api/vault/items/:id
// @access  Private
export const deleteItem = async (req, res) => {
  try {
    const item = await VaultItem.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.status(200).json({ success: true, message: 'Item deleted', id: req.params.id });
  } catch (error) {
    console.error('Vault item delete error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Add generic custom template
// @route   POST /api/vault/templates
// @access  Private
export const createTemplate = async (req, res) => {
  try {
    const { id, label, icon, fields } = req.body;
    const settings = await VaultSettings.findOne({ user: req.user._id });
    
    if (!settings) {
         return res.status(404).json({ success: false, message: 'Vault settings not found' });
    }

    settings.customTemplates.push({ id, label, icon, fields });
    await settings.save();
    
    res.status(200).json({ success: true, customTemplates: settings.customTemplates });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Authorize AI MCP Vault Session via frontend modal
// @route   POST /api/vault/mcp/authorize
// @access  Private
export const authorizeMcpVaultSession = async (req, res) => {
  try {
    const { masterPassword, keyBase64, durationMinutes = 15 } = req.body;
    const settings = await VaultSettings.findOne({ user: req.user._id });
    if (!settings) {
      return res.status(404).json({ success: false, message: 'Vault not initialized yet' });
    }

    let key = null;
    if (keyBase64) {
      key = Buffer.from(keyBase64, 'base64');
    } else if (masterPassword) {
      key = deriveVaultKeySync(masterPassword, settings.salt);
    } else {
      return res.status(400).json({ success: false, message: 'Master password or key is required' });
    }

    const isValid = verifyVaultKey(key, settings.verifier, settings.verifierIv);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid master password' });
    }

    const duration = Math.min(Math.max(parseInt(durationMinutes, 10) || 15, 1), 120);
    const sessionData = setMcpVaultSession(req.user._id, key, duration);

    res.status(200).json({
      success: true,
      message: `AI MCP Vault session authorized for ${duration} minutes`,
      expiresAt: sessionData.expiresAt,
      durationMinutes: sessionData.durationMinutes,
    });
  } catch (error) {
    console.error('Authorize MCP Vault Session error:', error);
    res.status(500).json({ success: false, message: 'Server error authorizing vault session' });
  }
};

// @desc    Generate a secure one-time MCP vault authorization token
// @route   POST /api/vault/mcp/token
// @access  Private
export const createMcpOneTimeTokenController = async (req, res) => {
  try {
    const { masterPassword, keyBase64, ttlMinutes = 10, maxUses = 1 } = req.body;
    const settings = await VaultSettings.findOne({ user: req.user._id });
    if (!settings) {
      return res.status(404).json({ success: false, message: 'Vault not initialized yet' });
    }

    let key = null;
    if (keyBase64) {
      key = Buffer.from(keyBase64, 'base64');
    } else if (masterPassword) {
      key = deriveVaultKeySync(masterPassword, settings.salt);
    } else {
      // Check if there is already an active session we can use
      const activeSess = getMcpVaultSession(req.user._id);
      if (activeSess) {
        key = activeSess.key;
      } else {
        return res.status(400).json({ success: false, message: 'Master password or key is required to generate token' });
      }
    }

    const isValid = verifyVaultKey(key, settings.verifier, settings.verifierIv);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid master password' });
    }

    const tokenData = createMcpOneTimeToken(req.user._id, key, maxUses || 1, ttlMinutes || 10);

    res.status(200).json({
      success: true,
      token: tokenData.token,
      expiresAt: tokenData.expiresAt,
      maxUses: tokenData.maxUses,
      message: 'One-time MCP session token created successfully',
    });
  } catch (error) {
    console.error('Generate MCP Token error:', error);
    res.status(500).json({ success: false, message: 'Server error generating token' });
  }
};

// @desc    Get current AI MCP Vault Session status
// @route   GET /api/vault/mcp/session
// @access  Private
export const getMcpVaultSessionStatus = async (req, res) => {
  try {
    const session = getMcpVaultSession(req.user._id);
    if (!session) {
      return res.status(200).json({
        success: true,
        isAuthorized: false,
        remainingMinutes: 0,
        expiresAt: null,
      });
    }

    const remainingMinutes = Math.max(0, Math.ceil((session.expiresAt - Date.now()) / (60 * 1000)));
    res.status(200).json({
      success: true,
      isAuthorized: true,
      expiresAt: session.expiresAt,
      remainingMinutes,
      durationMinutes: session.durationMinutes,
    });
  } catch (error) {
    console.error('Get MCP Session Status error:', error);
    res.status(500).json({ success: false, message: 'Server error getting session status' });
  }
};

// @desc    Revoke current AI MCP Vault Session
// @route   POST /api/vault/mcp/revoke
// @access  Private
export const revokeMcpVaultSessionController = async (req, res) => {
  try {
    revokeMcpVaultSession(req.user._id);
    res.status(200).json({
      success: true,
      message: 'AI MCP Vault Session revoked successfully',
    });
  } catch (error) {
    console.error('Revoke MCP Session error:', error);
    res.status(500).json({ success: false, message: 'Server error revoking session' });
  }
};

// @desc    Authorize AI Vault Session (capability-based)
// @route   POST /api/vault/ai-session/authorize
// @access  Private
export const authorizeAIVaultSession = async (req, res) => {
  try {
    const { permissions, allowedItemIds, durationMinutes = 30 } = req.body;

    // This endpoint should NOT accept master password
    // Instead, return authorization URL for frontend modal
    const authUrl = `${process.env.FRONTEND_URL}/vault/authorize-ai-session`;
    
    res.status(200).json({
      success: true,
      requiresUserAuthorization: true,
      authorizationUrl: authUrl,
      expiresIn: 300, // 5 minutes to complete authorization
      requestedPermissions: permissions || {
        listItems: true,
        readMetadata: true,
        createSecureLink: true,
        revealSecret: false,
        createItems: false,
        updateItems: false,
        deleteItems: false,
      },
      requestedDuration: Math.min(durationMinutes || 30, 120),
      requestedAllowedItems: allowedItemIds || null,
    });
  } catch (error) {
    console.error('Authorize AI Vault Session error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Complete AI Vault Session authorization (called by frontend after master password unlock)
// @route   POST /api/vault/ai-session/complete
// @access  Private
export const completeAIVaultSessionAuthorization = async (req, res) => {
  try {
    const { masterPassword, permissions, allowedItemIds, durationMinutes = 30 } = req.body;
    
    const settings = await VaultSettings.findOne({ user: req.user._id });
    if (!settings) {
      return res.status(404).json({ success: false, message: 'Vault not initialized' });
    }

    if (!masterPassword) {
      return res.status(400).json({ success: false, message: 'Master password required' });
    }

    // Verify master password
    const key = deriveVaultKeySync(masterPassword, settings.salt);
    const isValid = verifyVaultKey(key, settings.verifier, settings.verifierIv);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid master password' });
    }

    // Generate secure session token
    const sessionToken = `mcp_session_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + Math.min(durationMinutes || 30, 120) * 60 * 1000);

    // Create capability-based session
    const session = await AIVaultSession.create({
      user: req.user._id,
      tokenHash,
      permissions: permissions || {
        listItems: true,
        readMetadata: true,
        createSecureLink: true,
        revealSecret: false,
        createItems: false,
        updateItems: false,
        deleteItems: false,
      },
      allowedItemIds: allowedItemIds || [],
      expiresAt,
    });

    // Also set legacy in-memory session for backward compatibility
    setMcpVaultSession(req.user._id, key, Math.min(durationMinutes || 30, 120));

    // Audit log
    await VaultAuditLog.create({
      user: req.user._id,
      action: 'ai_session_created',
      details: `AI session authorized with ${Object.values(session.permissions).filter(Boolean).length} permissions`,
    });

    res.status(200).json({
      success: true,
      session_token: sessionToken,
      expiresAt: session.expiresAt,
      permissions: session.permissions,
      allowedItemIds: session.allowedItemIds,
    });
  } catch (error) {
    console.error('Complete AI Vault Session error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get AI Vault Session status
// @route   GET /api/vault/ai-session/status
// @access  Private
export const getAIVaultSessionStatus = async (req, res) => {
  try {
    const sessions = await AIVaultSession.find({
      user: req.user._id,
      expiresAt: { $gt: new Date() },
      revoked: false,
    }).sort({ createdAt: -1 });

    const activeSessions = sessions.map(s => ({
      id: s._id,
      permissions: s.permissions,
      allowedItemIds: s.allowedItemIds,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
    }));

    res.status(200).json({
      success: true,
      activeSessions,
      count: activeSessions.length,
    });
  } catch (error) {
    console.error('Get AI Session Status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Revoke AI Vault Session
// @route   POST /api/vault/ai-session/revoke/:id
// @access  Private
export const revokeAIVaultSession = async (req, res) => {
  try {
    const session = await AIVaultSession.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    session.revoked = true;
    await session.save();

    // Revoke any access links created by this session
    await VaultAccessLink.updateMany(
      { createdBySessionId: session._id },
      { $set: { usedAt: new Date() } }
    );

    // Audit log
    await VaultAuditLog.create({
      user: req.user._id,
      action: 'ai_session_revoked',
      details: `AI session ${session._id} revoked`,
    });

    res.status(200).json({
      success: true,
      message: 'AI session revoked successfully',
    });
  } catch (error) {
    console.error('Revoke AI Session error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create vault access link (temporary secure link)
// @route   POST /api/vault/access-link/create
// @access  Private
export const createVaultAccessLink = async (req, res) => {
  try {
    const { itemId, sessionToken, expiresInSeconds = 300, oneTimeUse = true } = req.body;

    if (!itemId) {
      return res.status(400).json({ success: false, message: 'Item ID required' });
    }

    // Verify item belongs to user
    const item = await VaultItem.findOne({ _id: itemId, user: req.user._id });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Verify session if provided
    let session = null;
    if (sessionToken) {
      const tokenHash = hashToken(sessionToken);
      session = await AIVaultSession.findOne({
        tokenHash,
        user: req.user._id,
        expiresAt: { $gt: new Date() },
        revoked: false,
      });

      if (!session) {
        return res.status(401).json({ success: false, message: 'Invalid or expired session' });
      }

      // Check permission
      if (!session.permissions.createSecureLink) {
        return res.status(403).json({ 
          success: false, 
          message: 'Session does not have permission to create access links' 
        });
      }

      // Check if item is in allowed list
      if (session.allowedItemIds && session.allowedItemIds.length > 0) {
        if (!session.allowedItemIds.includes(itemId)) {
          return res.status(403).json({
            success: false,
            message: 'Item not in session allowed list',
          });
        }
      }
    }

    // Generate opaque token for URL
    const linkToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(linkToken);
    const expiresAt = new Date(Date.now() + Math.min(expiresInSeconds, 900) * 1000); // Max 15 min

    // Create access link
    const link = await VaultAccessLink.create({
      user: req.user._id,
      vaultItemId: itemId,
      tokenHash,
      expiresAt,
      oneTimeUse,
      createdBySessionId: session?._id,
    });

    // Audit log
    await VaultAuditLog.create({
      user: req.user._id,
      action: 'access_link_created',
      vaultItemId: itemId,
      accessLinkId: link._id,
      details: `Access link created, expires in ${expiresInSeconds}s, oneTimeUse: ${oneTimeUse}`,
    });

    const accessUrl = `${process.env.FRONTEND_URL}/vault/access/${linkToken}`;

    res.status(200).json({
      success: true,
      url: accessUrl,
      expiresInSeconds: Math.min(expiresInSeconds, 900),
      oneTimeUse,
      itemId,
      linkId: link._id,
    });
  } catch (error) {
    console.error('Create Access Link error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Access vault item via secure link (frontend calls this)
// @route   GET /api/vault/access-link/:token
// @access  Public (but requires valid token)
export const accessVaultViaLink = async (req, res) => {
  try {
    const { token } = req.params;
    const tokenHash = hashToken(token);

    const link = await VaultAccessLink.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() },
    });

    if (!link) {
      return res.status(404).json({ success: false, message: 'Invalid or expired link' });
    }

    if (link.usedAt && link.oneTimeUse) {
      return res.status(410).json({ success: false, message: 'Link already used' });
    }

    // Mark as used if one-time
    if (link.oneTimeUse) {
      link.usedAt = new Date();
      await link.save();
    }

    // Fetch the item
    const item = await VaultItem.findById(link.vaultItemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Audit log
    await VaultAuditLog.create({
      user: link.user,
      action: 'access_link_used',
      vaultItemId: link.vaultItemId,
      accessLinkId: link._id,
      details: 'Access link used to view item',
    });

    // Return metadata only (frontend will handle decryption if user unlocks)
    res.status(200).json({
      success: true,
      itemId: item._id,
      type: item.type,
      isFavorite: item.isFavorite,
      updatedAt: item.updatedAt,
      // Do NOT return encrypted data here - let frontend handle via normal flow
      message: 'Use your master password in the DayToDay UI to decrypt this item',
    });
  } catch (error) {
    console.error('Access Link error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Revoke access link
// @route   POST /api/vault/access-link/revoke/:id
// @access  Private
export const revokeVaultAccessLink = async (req, res) => {
  try {
    const link = await VaultAccessLink.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!link) {
      return res.status(404).json({ success: false, message: 'Link not found' });
    }

    link.usedAt = new Date(); // Mark as used to invalidate
    await link.save();

    // Audit log
    await VaultAuditLog.create({
      user: req.user._id,
      action: 'access_link_revoked',
      vaultItemId: link.vaultItemId,
      accessLinkId: link._id,
      details: 'Access link revoked',
    });

    res.status(200).json({
      success: true,
      message: 'Access link revoked',
    });
  } catch (error) {
    console.error('Revoke Access Link error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get vault audit log
// @route   GET /api/vault/audit-log
// @access  Private
export const getVaultAuditLog = async (req, res) => {
  try {
    const { limit = 50, offset = 0, action } = req.query;

    const filter = { user: req.user._id };
    if (action) filter.action = action;

    const logs = await VaultAuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit));

    const total = await VaultAuditLog.countDocuments(filter);

    res.status(200).json({
      success: true,
      logs,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('Get Audit Log error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
