import VaultSettings from '../models/VaultSettings.js';
import VaultItem from '../models/VaultItem.js';
import {
  setMcpVaultSession,
  getMcpVaultSession,
  revokeMcpVaultSession,
  createMcpOneTimeToken,
  deriveVaultKeySync,
  verifyVaultKey,
} from '../mcp/server.js';

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
