import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import McpOAuthClient from '../../models/McpOAuthClient.js';
import AuditLog from '../../models/AuditLog.js';
import { logAuditEvent } from '../../services/auditService.js';

export const getMcpClients = async (req, res) => {
  try {
    const clients = await McpOAuthClient.find()
      .sort({ createdAt: -1 })
      .lean();

    const formatted = clients.map((c) => ({
      _id: c._id,
      clientName: c.clientName || 'MCP Client',
      clientId: c.clientId,
      // Masked client ID representation if long
      maskedClientId: c.clientId.length > 16 ? `${c.clientId.slice(0, 10)}...${c.clientId.slice(-4)}` : c.clientId,
      redirectUris: c.redirectUris || [],
      grantTypes: c.grantTypes || ['authorization_code'],
      responseTypes: c.responseTypes || ['code'],
      status: c.status || 'active',
      lastUsed: c.lastUsed || c.updatedAt || null,
      createdAt: c.createdAt,
      description: c.description || '',
    }));

    res.json({
      success: true,
      clients: formatted,
    });
  } catch (error) {
    console.error('Error in getMcpClients:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve MCP clients' });
  }
};

export const getMcpClientDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await McpOAuthClient.findById(id).lean();
    if (!client) {
      return res.status(404).json({ success: false, message: 'OAuth client not found' });
    }

    // Fetch recent OAuth activity for this client
    const activity = await AuditLog.find({
      $or: [{ target: client.clientId }, { target: String(client._id) }],
    })
      .sort({ timestamp: -1 })
      .limit(25)
      .select('timestamp event user ip result message')
      .lean();

    res.json({
      success: true,
      client: {
        _id: client._id,
        clientName: client.clientName,
        clientId: client.clientId,
        maskedClientId: client.clientId,
        redirectUris: client.redirectUris,
        grantTypes: client.grantTypes,
        responseTypes: client.responseTypes,
        tokenEndpointAuthMethod: client.tokenEndpointAuthMethod,
        status: client.status || 'active',
        lastUsed: client.lastUsed,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
        description: client.description || '',
      },
      activity,
    });
  } catch (error) {
    console.error('Error in getMcpClientDetails:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve client details' });
  }
};

export const registerMcpClient = async (req, res) => {
  try {
    const { clientName, redirectUris, description } = req.body;

    if (!clientName || !redirectUris) {
      return res.status(400).json({
        success: false,
        message: 'Client name and redirect URIs are required',
      });
    }

    const urisArray = Array.isArray(redirectUris)
      ? redirectUris
      : String(redirectUris)
          .split('\n')
          .map((u) => u.trim())
          .filter(Boolean);

    if (urisArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one valid redirect URI is required',
      });
    }

    // Generate random client ID and client secret
    const rawClientId = 'daytoday_mcp_' + crypto.randomBytes(8).toString('hex');
    const rawClientSecret = 'sec_' + crypto.randomBytes(24).toString('hex');
    const clientSecretHash = await bcrypt.hash(rawClientSecret, 10);

    const client = await McpOAuthClient.create({
      clientId: rawClientId,
      clientSecretHash,
      clientName: clientName.trim(),
      redirectUris: urisArray,
      grantTypes: ['authorization_code', 'refresh_token'],
      responseTypes: ['code'],
      status: 'active',
      description: description ? description.trim() : '',
      userId: req.user._id,
    });

    await logAuditEvent({
      level: 'INFO',
      event: 'MCP_CLIENT_REGISTERED',
      target: rawClientId,
      adminUser: req.user.email,
      adminId: req.user._id,
      message: `Registered new OAuth client: ${clientName}`,
      req,
    });

    // Return the secret ONCE upon creation with explicit warning
    res.status(201).json({
      success: true,
      message: 'OAuth Client registered successfully. Save the client secret now; it will never be displayed again.',
      client: {
        _id: client._id,
        clientId: client.clientId,
        clientName: client.clientName,
        redirectUris: client.redirectUris,
        status: client.status,
      },
      credentials: {
        clientId: rawClientId,
        clientSecret: rawClientSecret,
      },
    });
  } catch (error) {
    console.error('Error in registerMcpClient:', error);
    res.status(500).json({ success: false, message: 'Failed to register MCP client' });
  }
};

export const toggleClientStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await McpOAuthClient.findById(id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'OAuth client not found' });
    }

    client.status = client.status === 'active' ? 'revoked' : 'active';
    await client.save();

    const action = client.status === 'active' ? 'MCP_CLIENT_ACTIVATED' : 'MCP_CLIENT_REVOKED';
    await logAuditEvent({
      level: 'WARN',
      event: action,
      target: client.clientId,
      adminUser: req.user.email,
      adminId: req.user._id,
      message: `Client status changed to ${client.status} for ${client.clientName}`,
      req,
    });

    res.json({
      success: true,
      message: `Client status is now ${client.status}`,
      status: client.status,
    });
  } catch (error) {
    console.error('Error in toggleClientStatus:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle client status' });
  }
};

export const deleteMcpClient = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await McpOAuthClient.findById(id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'OAuth client not found' });
    }

    const clientId = client.clientId;
    const clientName = client.clientName;

    await McpOAuthClient.findByIdAndDelete(id);

    await logAuditEvent({
      level: 'WARN',
      event: 'MCP_CLIENT_DELETED',
      target: clientId,
      adminUser: req.user.email,
      adminId: req.user._id,
      message: `Deleted OAuth client ${clientName} (${clientId})`,
      req,
    });

    res.json({
      success: true,
      message: `OAuth client ${clientName} deleted successfully`,
    });
  } catch (error) {
    console.error('Error in deleteMcpClient:', error);
    res.status(500).json({ success: false, message: 'Failed to delete MCP client' });
  }
};
