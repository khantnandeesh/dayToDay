import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import Session from '../models/Session.js';
import McpOAuthClient from '../models/McpOAuthClient.js';
import AuditLog from '../models/AuditLog.js';

export async function seedInitialData() {
  try {
    // 1. Ensure Admin User exists
    let admin = await User.findOne({ email: 'nandeesh@nandeesh.dev' });
    if (!admin) {
      admin = await User.create({
        name: 'Nandeesh',
        email: 'nandeesh@nandeesh.dev',
        password: 'Admin@123456',
        role: 'admin',
        isActive: true,
        twoFactorEnabled: false,
        lastLogin: new Date(),
        devices: [
          {
            deviceId: 'dev_admin_primary_mac',
            deviceName: 'Apple Mac (macOS / Chrome)',
            browserName: 'Chrome',
            browserVersion: '128.0',
            osName: 'macOS',
            osVersion: '14.6',
            deviceType: 'desktop',
            ip: '127.0.0.1',
            lastActive: new Date(),
          },
        ],
      });
      console.log('✅ Created primary admin user: nandeesh@nandeesh.dev (Password: Admin@123456)');
    } else {
      // Ensure role is admin
      if (admin.role !== 'admin') {
        admin.role = 'admin';
        await admin.save();
      }
    }

    // Secondary convenience admin
    const secondAdmin = await User.findOne({ email: 'admin@nandeesh.dev' });
    if (!secondAdmin) {
      await User.create({
        name: 'System Admin',
        email: 'admin@nandeesh.dev',
        password: 'Admin@123456',
        role: 'admin',
        isActive: true,
        twoFactorEnabled: false,
        lastLogin: new Date(),
      });
    }

    // 2. Ensure sample users exist if user count < 3
    const userCount = await User.countDocuments();
    if (userCount <= 2) {
      const sampleUsers = [
        {
          name: 'John Doe',
          email: 'john.doe@example.com',
          password: 'Password@123',
          role: 'user',
          isActive: true,
          twoFactorEnabled: true,
          lastLogin: new Date(Date.now() - 25 * 60 * 1000),
          lastSuccessfulVerification: new Date(Date.now() - 25 * 60 * 1000),
          devices: [
            {
              deviceId: 'dev_john_win',
              deviceName: 'Dell XPS (Windows 11 / Firefox)',
              browserName: 'Firefox',
              browserVersion: '129.0',
              osName: 'Windows',
              osVersion: '11',
              deviceType: 'desktop',
              ip: '103.45.88.12',
              lastActive: new Date(Date.now() - 10 * 60 * 1000),
            },
          ],
        },
        {
          name: 'Alex Chen',
          email: 'alex.chen@example.com',
          password: 'Password@123',
          role: 'user',
          isActive: true,
          twoFactorEnabled: true,
          lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000),
          lastSuccessfulVerification: new Date(Date.now() - 2 * 60 * 60 * 1000),
          devices: [
            {
              deviceId: 'dev_alex_mac',
              deviceName: 'MacBook Pro (macOS / Chrome)',
              browserName: 'Chrome',
              browserVersion: '128.0',
              osName: 'macOS',
              osVersion: '14.5',
              deviceType: 'desktop',
              ip: '172.56.21.90',
              lastActive: new Date(Date.now() - 40 * 60 * 1000),
            },
            {
              deviceId: 'dev_alex_iphone',
              deviceName: 'iPhone 15 Pro (iOS / Safari)',
              browserName: 'Mobile Safari',
              browserVersion: '17.5',
              osName: 'iOS',
              osVersion: '17.5',
              deviceType: 'mobile',
              ip: '172.56.21.90',
              lastActive: new Date(Date.now() - 5 * 60 * 1000),
            },
          ],
        },
        {
          name: 'Sarah Dev',
          email: 'sarah.dev@example.com',
          password: 'Password@123',
          role: 'user',
          isActive: true,
          twoFactorEnabled: false,
          lastLogin: new Date(Date.now() - 5 * 60 * 1000),
          devices: [
            {
              deviceId: 'dev_sarah_linux',
              deviceName: 'ThinkPad (Ubuntu Linux / Brave)',
              browserName: 'Brave',
              browserVersion: '1.68',
              osName: 'Linux',
              osVersion: 'Ubuntu 24.04',
              deviceType: 'desktop',
              ip: '198.51.100.44',
              lastActive: new Date(Date.now() - 2 * 60 * 1000),
            },
          ],
        },
        {
          name: 'Suspended Account',
          email: 'suspended@example.com',
          password: 'Password@123',
          role: 'user',
          isActive: false,
          twoFactorEnabled: true,
          failedLoginAttempts: 6,
          lastLogin: new Date(Date.now() - 48 * 60 * 60 * 1000),
          devices: [],
        },
      ];

      for (const u of sampleUsers) {
        const createdUser = await User.create(u);

        // Create sample active sessions
        if (createdUser.isActive && createdUser.devices.length > 0) {
          for (const dev of createdUser.devices) {
            const token = 'sample_token_' + crypto.randomBytes(16).toString('hex');
            await Session.create({
              userId: createdUser._id,
              deviceId: dev.deviceId,
              token,
              duration: 24,
              expiresAt: new Date(Date.now() + 18 * 60 * 60 * 1000),
              isActive: true,
              deviceInfo: {
                deviceName: dev.deviceName,
                browser: dev.browserName,
                browserName: dev.browserName,
                browserVersion: dev.browserVersion,
                os: dev.osName,
                osName: dev.osName,
                osVersion: dev.osVersion,
                deviceType: dev.deviceType,
                ip: dev.ip,
              },
            });
          }
        }
      }
    }

    // 3. Ensure sample MCP OAuth clients exist
    const clientCount = await McpOAuthClient.countDocuments();
    if (clientCount === 0) {
      await McpOAuthClient.create({
        clientId: 'daytoday_mcp_cursor_ai_agent',
        clientSecretHash: await bcrypt.hash('cursor_mcp_secret_key_prod_8892', 10),
        clientName: 'Cursor AI Assistant',
        redirectUris: ['http://localhost:8989/oauth/callback', 'vscode://cursor.cursor/oauth'],
        grantTypes: ['authorization_code', 'refresh_token'],
        responseTypes: ['code'],
        status: 'active',
        lastUsed: new Date(Date.now() - 15 * 60 * 1000),
        description: 'IDE integration for Model Context Protocol code assistant',
      });

      await McpOAuthClient.create({
        clientId: 'daytoday_mcp_claude_desktop',
        clientSecretHash: await bcrypt.hash('claude_desktop_secret_key_prod_9912', 10),
        clientName: 'Claude Desktop App',
        redirectUris: ['http://localhost:3333/callback', 'https://claude.ai/oauth/callback'],
        grantTypes: ['authorization_code', 'refresh_token'],
        responseTypes: ['code'],
        status: 'active',
        lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000),
        description: 'Claude Desktop client for DayToDay files & vault tools',
      });
    }

    // 4. Ensure initial audit logs exist
    const auditCount = await AuditLog.countDocuments();
    if (auditCount === 0) {
      const logs = [
        {
          timestamp: new Date(Date.now() - 8 * 60 * 1000),
          level: 'INFO',
          event: 'LOGIN',
          user: 'john.doe@example.com',
          ip: '103.45.88.12',
          device: 'Firefox 129.0 / Windows 11',
          result: 'Success',
          message: 'User completed password authentication',
        },
        {
          timestamp: new Date(Date.now() - 9 * 60 * 1000),
          level: 'INFO',
          event: '2FA_VERIFY',
          user: 'john.doe@example.com',
          ip: '103.45.88.12',
          device: 'Firefox 129.0 / Windows 11',
          result: 'Success',
          message: 'Two-factor authentication verified successfully',
        },
        {
          timestamp: new Date(Date.now() - 25 * 60 * 1000),
          level: 'WARN',
          event: 'FAILED_LOGIN',
          user: 'unknown@external.net',
          ip: '45.12.98.22',
          device: 'curl/7.88.1',
          result: 'Failed',
          message: 'Invalid email or password combination',
        },
        {
          timestamp: new Date(Date.now() - 40 * 60 * 1000),
          level: 'INFO',
          event: 'DEVICE_LOGOUT',
          user: 'alex.chen@example.com',
          ip: '172.56.21.90',
          device: 'Chrome 128.0 / macOS 14.5',
          result: 'Success',
          message: 'Terminated session on secondary device',
        },
        {
          timestamp: new Date(Date.now() - 60 * 60 * 1000),
          level: 'INFO',
          event: 'MCP_TOKEN_ISSUED',
          user: 'sarah.dev@example.com',
          ip: '198.51.100.44',
          device: 'Cursor IDE',
          result: 'Success',
          target: 'daytoday_mcp_cursor_ai_agent',
          message: 'Issued OAuth 2.0 access token to Cursor AI Assistant',
        },
        {
          timestamp: new Date(Date.now() - 90 * 60 * 1000),
          level: 'INFO',
          event: 'ADMIN_LOGIN',
          user: 'nandeesh@nandeesh.dev',
          adminUser: 'nandeesh@nandeesh.dev',
          ip: '127.0.0.1',
          device: 'Chrome 128.0 / macOS',
          result: 'Success',
          message: 'Administrator signed in to management console',
        },
      ];

      for (const log of logs) {
        await AuditLog.create(log);
      }
    }
  } catch (err) {
    console.error('Seeding initial data warning:', err.message);
  }
}
