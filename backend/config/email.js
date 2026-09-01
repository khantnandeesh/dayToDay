import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { Resend } from "resend";

dotenv.config();

let resendClient = null;
let nodemailerTransporter = null;

/**
 * Initialize or get the Nodemailer Gmail/SMTP Transporter
 */
const getNodemailerTransporter = () => {
  const user = process.env.EMAIL_USER;
  // Strip any spaces from Google App Passwords (e.g. "uzed ejob wfrv ylgd" -> "uzedejobwfrvylgd")
  const pass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, "") : null;

  if (!user || !pass) {
    return null;
  }

  if (!nodemailerTransporter) {
    try {
      nodemailerTransporter = nodemailer.createTransporter
        ? nodemailer.createTransporter({
            service: "gmail",
            auth: {
              user: user.trim(),
              pass: pass.trim(),
            },
          })
        : nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: user.trim(),
              pass: pass.trim(),
            },
          });
      console.log(`✉️ Nodemailer Gmail transporter initialized for ${user}`);
    } catch (err) {
      console.error("❌ Failed to initialize Nodemailer transporter:", err.message);
      return null;
    }
  }
  return nodemailerTransporter;
};

/**
 * Initialize or get the Resend Client
 */
const getResend = () => {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (key && key.trim()) {
      try {
        resendClient = new Resend(key.trim());
        console.log("✉️ Resend client initialized");
      } catch (err) {
        console.error("❌ Failed to initialize Resend client:", err.message);
        return null;
      }
    }
  }
  return resendClient;
};

// Helper: wrap HTML in a minimal, sophisticated shell
const wrapHtml = (innerHtml, title) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <title>${title || "DayToDay"}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#ffffff;font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;min-width:320px;background-color:#ffffff;">
      <tr>
        <td align="center" style="padding:60px 20px;">
          <div style="max-width:480px;width:100%;margin:0 auto;text-align:left;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:40px;">
              <tr>
                <td valign="middle">
                  <span style="font-size:18px;font-weight:600;letter-spacing:-0.5px;color:#000000;">
                    DayToDay
                  </span>
                </td>
              </tr>
            </table>

            <div style="line-height:1.6;font-size:15px;color:#333333;">
              ${innerHtml}
            </div>

            <div style="margin-top:60px;padding-top:20px;border-top:1px solid #eaeaea;">
              <p style="margin:0;font-size:12px;color:#888888;">
                DayToDay &bull; Secure Encrypted Vault
              </p>
              <p style="margin:4px 0 0 0;font-size:12px;color:#888888;">
                You received this email given your account activity.
              </p>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

/**
 * Universal resilient mail sender
 * 1. Tries Gmail SMTP / Nodemailer (EMAIL_USER + EMAIL_PASS)
 * 2. Tries Resend (RESEND_API_KEY) with domain fallback
 * 3. Falls back to console log with clear verification code
 */
const sendMailResilient = async ({ to, subject, html, text, fromTitle = "DayToDay Security" }) => {
  let lastError = null;

  // 1. Try Nodemailer (Gmail / SMTP)
  const transporter = getNodemailerTransporter();
  if (transporter) {
    try {
      const fromAddress = process.env.EMAIL_FROM || `"${fromTitle}" <${process.env.EMAIL_USER}>`;
      const result = await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
        text: text || subject,
      });
      console.log(`✅ Email delivered to ${to} via Gmail/Nodemailer (MsgID: ${result.messageId})`);
      return { success: true, provider: "nodemailer", messageId: result.messageId };
    } catch (err) {
      console.warn(`⚠️ Nodemailer delivery attempt to ${to} failed:`, err.message);
      lastError = err;
    }
  }

  // 2. Try Resend
  const resend = getResend();
  if (resend) {
    // Determine from address for Resend
    const customFrom = process.env.EMAIL_FROM || process.env.RESEND_FROM || `DayToDay Security <security@nandeeshkhant.info>`;
    const testFrom = `DayToDay Security <onboarding@resend.dev>`;

    // Attempt 2a: configured from address
    try {
      const resendRes = await resend.emails.send({
        from: customFrom,
        to,
        subject,
        html,
      });

      if (resendRes.error) {
        throw new Error(resendRes.error.message || JSON.stringify(resendRes.error));
      }

      console.log(`✅ Email delivered to ${to} via Resend (ID: ${resendRes.data?.id})`);
      return { success: true, provider: "resend", id: resendRes.data?.id };
    } catch (resendErr) {
      console.warn(`⚠️ Resend delivery with [${customFrom}] failed:`, resendErr.message);
      lastError = resendErr;

      // Attempt 2b: Fallback to onboarding@resend.dev if custom domain failed
      if (customFrom !== testFrom) {
        try {
          const retryRes = await resend.emails.send({
            from: testFrom,
            to,
            subject,
            html,
          });
          if (!retryRes.error) {
            console.log(`✅ Email delivered to ${to} via Resend (test sender ID: ${retryRes.data?.id})`);
            return { success: true, provider: "resend-test", id: retryRes.data?.id };
          }
        } catch {
          // Ignore retry error and fall through
        }
      }
    }
  }

  // 3. Fallback / Dev Mode
  console.log(`\n======================================================`);
  console.log(`📬 [EMAIL SIMULATOR / CONSOLE FALLBACK]`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  if (lastError) {
    console.log(`Provider Error: ${lastError.message}`);
  }
  console.log(`======================================================\n`);

  return {
    success: true,
    fallback: true,
    warning: lastError ? lastError.message : "No email provider configured",
  };
};

// ------------------------------------------------------
//  SEND 2FA CODE EMAIL
// ------------------------------------------------------
export const send2FACode = async (email, code, userName) => {
  const content = `
    <h1 style="margin:0 0 24px 0;font-size:24px;font-weight:600;color:#000000;letter-spacing:-0.5px;">Verification Code</h1>
    
    <p style="margin:0 0 24px 0;">
      Hello ${userName || "there"}, use this code to securely sign in to your account.
    </p>

    <div style="margin:32px 0;">
      <span style="font-family:'SF Mono', 'Menlo', 'Courier New', monospace;font-size:32px;font-weight:600;letter-spacing:4px;color:#000000;background-color:#f4f4f5;padding:8px 16px;border-radius:8px;display:inline-block;">
        ${code}
      </span>
    </div>

    <p style="margin:0 0 8px 0;font-size:13px;color:#666666;">
      This code will expire in 10 minutes. If you didn't request this, please ignore this email.
    </p>
  `;

  const html = wrapHtml(content, "Verification Code");
  const subject = `${code} is your DayToDay verification code`;
  const text = `Hello ${userName || "there"},\n\nYour DayToDay verification code is: ${code}\n\nThis code will expire in 10 minutes.`;

  console.log(`🔑 [2FA DISPATCH] Generating verification code ${code} for ${email}`);
  return await sendMailResilient({
    to: email,
    subject,
    html,
    text,
    fromTitle: "DayToDay Security",
  });
};

// ------------------------------------------------------
//  SEND WELCOME EMAIL
// ------------------------------------------------------
export const sendWelcomeEmail = async (email, userName) => {
  const content = `
    <h1 style="margin:0 0 24px 0;font-size:24px;font-weight:600;color:#000000;letter-spacing:-0.5px;">Welcome to DayToDay</h1>
    
    <p style="margin:0 0 24px 0;">
      Hi ${userName || "there"},
    </p>
    <p style="margin:0 0 24px 0;">
      Your secure vault is ready. We've built DayToDay to be the safest place for your digital life, combining military-grade encryption with a beautiful user experience.
    </p>

    <div style="margin:32px 0;padding:24px;background-color:#f9f9f9;border-radius:12px;">
      <h3 style="margin:0 0 12px 0;font-size:14px;font-weight:600;color:#000000;text-transform:uppercase;letter-spacing:0.5px;">Next Steps</h3>
      <ul style="margin:0;padding:0 0 0 16px;color:#333333;">
        <li style="margin-bottom:8px;">Add your most used passwords to the vault.</li>
        <li style="margin-bottom:8px;">Upload critical documents to Secure Drive.</li>
        <li style="margin-bottom:0;">Check your profile to enable Two-Factor Authentication.</li>
      </ul>
    </div>
  `;

  const html = wrapHtml(content, "Welcome to DayToDay");
  const subject = "Welcome to your new vault";
  const text = `Hi ${userName || "there"},\n\nWelcome to DayToDay! Your secure vault is ready.`;

  return await sendMailResilient({
    to: email,
    subject,
    html,
    text,
    fromTitle: "DayToDay",
  });
};

// ------------------------------------------------------
//  SEND LOGIN ALERT
// ------------------------------------------------------
export const sendLoginAlert = async (email, userName, deviceInfo) => {
  const content = `
    <h1 style="margin:0 0 24px 0;font-size:24px;font-weight:600;color:#000000;letter-spacing:-0.5px;">New Sign-in Detected</h1>
    
    <p style="margin:0 0 32px 0;">
      A new device just signed in to your DayToDay account.
    </p>

    <div style="margin-bottom:32px;">
      <div style="margin-bottom:12px;display:flex;">
        <span style="font-weight:600;width:80px;color:#888888;">Device</span>
        <span style="color:#000000;">${deviceInfo?.os || "Unknown"} &bull; ${deviceInfo?.browser || "Unknown"}</span>
      </div>
      <div style="margin-bottom:12px;display:flex;">
        <span style="font-weight:600;width:80px;color:#888888;">Location</span>
        <span style="color:#000000;">${deviceInfo?.ip === "::1" ? "Localhost" : (deviceInfo?.ip || "Unknown")}</span>
      </div>
      <div style="display:flex;">
        <span style="font-weight:600;width:80px;color:#888888;">Time</span>
        <span style="color:#000000;">${new Date().toLocaleString("en-US", { hour: "numeric", minute: "numeric", hour12: true })}</span>
      </div>
    </div>

    <p style="margin:0;font-size:13px;color:#666666;">
      If this wasn't you, please secure your account immediately.
    </p>
  `;

  const html = wrapHtml(content, "New Sign-in");
  const subject = "New login to your DayToDay account";
  const text = `A new sign-in was detected on your DayToDay account from ${deviceInfo?.os || "device"} (${deviceInfo?.browser || ""}).`;

  return await sendMailResilient({
    to: email,
    subject,
    html,
    text,
    fromTitle: "DayToDay Security",
  });
};

/**
 * Diagnostic test utility to check configured email providers
 */
export const checkEmailProviders = async () => {
  const status = {
    nodemailerConfigured: Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS),
    emailUser: process.env.EMAIL_USER ? `${process.env.EMAIL_USER.slice(0, 4)}...` : null,
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
    resendKeyPrefix: process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.slice(0, 6) : null,
  };
  return status;
};

export default {
  send2FACode,
  sendWelcomeEmail,
  sendLoginAlert,
  checkEmailProviders,
};

