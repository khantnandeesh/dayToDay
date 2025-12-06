import VaultSettings from '../models/VaultSettings.js';
import VaultItem from '../models/VaultItem.js';

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
