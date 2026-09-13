import os from 'os';
import mongoose from 'mongoose';
import { getDbStatus } from '../../config/db.js';
import { checkEmailProviders } from '../../config/email.js';
import SystemSetting from '../../models/SystemSetting.js';
import { logAuditEvent, getClientIp } from '../../services/auditService.js';

export const getSystemSettings = async (req, res) => {
  try {
    const allowUserRegistration = await SystemSetting.getSetting('allow_user_registration', true);
    res.json({
      success: true,
      settings: {
        allowUserRegistration: Boolean(allowUserRegistration),
      },
    });
  } catch (error) {
    console.error('Error in getSystemSettings:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve system settings' });
  }
};

export const updateSystemSettings = async (req, res) => {
  try {
    const { allowUserRegistration } = req.body;
    const adminEmail = req.admin?.email || 'admin';

    if (typeof allowUserRegistration === 'boolean') {
      await SystemSetting.setSetting(
        'allow_user_registration',
        allowUserRegistration,
        adminEmail,
        'Controls whether new users can register via public sign-up'
      );

      await logAuditEvent({
        level: 'INFO',
        event: 'SYSTEM_POLICY_CHANGED',
        user: adminEmail,
        ip: getClientIp(req),
        result: 'Success',
        target: 'allow_user_registration',
        message: `Administrator toggled new user registration: ${allowUserRegistration ? 'ENABLED' : 'DISABLED'}`,
      });
    }

    const currentRegistrationSetting = await SystemSetting.getSetting('allow_user_registration', true);

    res.json({
      success: true,
      message: `User registration policy updated to: ${currentRegistrationSetting ? 'Enabled' : 'Disabled'}`,
      settings: {
        allowUserRegistration: Boolean(currentRegistrationSetting),
      },
    });
  } catch (error) {
    console.error('Error in updateSystemSettings:', error);
    res.status(500).json({ success: false, message: 'Failed to update system settings' });
  }
};

export const getSystemInfo = async (req, res) => {
  try {
    const uptimeSeconds = process.uptime();
    const days = Math.floor(uptimeSeconds / (24 * 3600));
    const hours = Math.floor((uptimeSeconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);

    const formattedUptime = `${days > 0 ? `${days}d ` : ''}${hours}h ${minutes}m ${seconds}s`;

    const mem = process.memoryUsage();
    const dbStatus = getDbStatus();
    const allowUserRegistration = await SystemSetting.getSetting('allow_user_registration', true);

    // Check presence of environment variables (BOOLEAN / STATUS ONLY, NEVER EXPOSE VALUES)
    const envStatus = {
      MONGODB_URI: Boolean(process.env.MONGODB_URI),
      JWT_SECRET: Boolean(process.env.JWT_SECRET),
      EMAIL_USER: Boolean(process.env.EMAIL_USER),
      EMAIL_PASS: Boolean(process.env.EMAIL_PASS),
      RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
      MCP_PUBLIC_URL: Boolean(process.env.MCP_PUBLIC_URL),
      MCP_CLIENT_ID: Boolean(process.env.MCP_CLIENT_ID),
      MCP_CLIENT_SECRET: Boolean(process.env.MCP_CLIENT_SECRET),
      R2_ENDPOINT: Boolean(process.env.R2_ENDPOINT),
      R2_ACCESS_KEY_ID: Boolean(process.env.R2_ACCESS_KEY_ID),
      R2_BUCKET: Boolean(process.env.R2_BUCKET),
      ONLINE_COMPILER_API_KEY: Boolean(process.env.ONLINE_COMPILER_API_KEY),
    };

    let emailHealth = {
      nodemailerConfigured: false,
      resendConfigured: false,
    };
    try {
      emailHealth = checkEmailProviders();
    } catch {}

    res.json({
      success: true,
      system: {
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        uptime: formattedUptime,
        uptimeSeconds: Math.floor(uptimeSeconds),
        platform: `${os.type()} (${os.arch()})`,
        osRelease: os.release(),
        hostname: os.hostname(),
        serverTime: new Date().toISOString(),
      },
      versions: {
        backend: '1.0.0',
        frontend: '1.0.0',
        mcpProtocol: '2024-11-05',
      },
      database: {
        status: dbStatus.connected ? 'Connected' : 'Disconnected',
        engine: dbStatus.isInMemory ? 'Embedded Mongo Memory Server' : 'External MongoDB Cluster',
        readyState: dbStatus.readyState,
        host: dbStatus.isInMemory ? 'Local Memory Socket' : (dbStatus.host || 'External Host'),
      },
      mcp: {
        status: 'Operational',
        streamableEndpoint: '/mcp',
        sseEndpoint: '/mcp/sse',
        metadataEndpoint: '/.well-known/oauth-authorization-server',
      },
      email: {
        nodemailer: emailHealth.nodemailerConfigured ? 'Configured' : 'Not Configured',
        resend: emailHealth.resendConfigured ? 'Configured' : 'Not Configured',
        mode: emailHealth.nodemailerConfigured || emailHealth.resendConfigured ? 'Live SMTP / API' : 'Simulated / Safe Dev',
      },
      memory: {
        rssMb: (mem.rss / (1024 * 1024)).toFixed(1),
        heapTotalMb: (mem.heapTotal / (1024 * 1024)).toFixed(1),
        heapUsedMb: (mem.heapUsed / (1024 * 1024)).toFixed(1),
        externalMb: (mem.external / (1024 * 1024)).toFixed(1),
      },
      policy: {
        allowUserRegistration: Boolean(allowUserRegistration),
      },
      envChecklist: Object.entries(envStatus).map(([key, configured]) => ({
        key,
        status: configured ? 'Configured' : 'Not Configured',
        configured,
      })),
    });
  } catch (error) {
    console.error('Error in getSystemInfo:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve system information' });
  }
};
