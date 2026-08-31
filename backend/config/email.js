import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config();

let resendClient = null;

const getResend = () => {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.warn("⚠️ RESEND_API_KEY environment variable is not configured; email sending will be simulated/skipped.");
      return null;
    }
    resendClient = new Resend(key);
  }
  return resendClient;
};

// Compatibility transporter object
const transporter = {
  verify: (cb) => cb(null, true),
};

// Helper: wrap HTML in a minimal, sophisticated shell
const wrapHtml = (innerHtml, title) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <title>${title || 'DayToDay'}</title>
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

// ------------------------------------------------------
//  SEND 2FA CODE EMAIL
// ------------------------------------------------------
export const send2FACode = async (email, code, userName) => {
  const resend = getResend();
  if (!resend) {
    console.log(`[Email Mock] 2FA verification code for ${email} is: ${code}`);
    return { success: true };
  }

  const content = `
    <h1 style="margin:0 0 24px 0;font-size:24px;font-weight:600;color:#000000;letter-spacing:-0.5px;">Verification Code</h1>
    
    <p style="margin:0 0 24px 0;">
      Hello ${userName || 'there'}, use this code to securely sign in to your account.
    </p>

    <div style="margin:32px 0;">
      <span style="font-family:'SF Mono', 'Menlo', 'Courier New', monospace;font-size:32px;font-weight:600;letter-spacing:4px;color:#000000;">
        ${code}
      </span>
    </div>

    <p style="margin:0 0 8px 0;font-size:13px;color:#666666;">
      This code will expire in 10 minutes. If you didn't request this, please ignore this email.
    </p>
  `;

  try {
    const html = wrapHtml(content, "Verification Code");
    await resend.emails.send({
      from: `DayToDay Security <security@nandeeshkhant.info>`,
      to: email,
      subject: `${code} is your DayToDay verification code`,
      html,
    });
    console.log(`📧 2FA Email sent to ${email} at ${new Date().toISOString()}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Error sending 2FA email:", error);
    return { success: false, error: error.message || String(error) };
  }
};

// ------------------------------------------------------
//  SEND WELCOME EMAIL
// ------------------------------------------------------
export const sendWelcomeEmail = async (email, userName) => {
  const resend = getResend();
  if (!resend) {
    console.log(`[Email Mock] Welcome email for ${email}`);
    return { success: true };
  }

  const content = `
    <h1 style="margin:0 0 24px 0;font-size:24px;font-weight:600;color:#000000;letter-spacing:-0.5px;">Welcome to DayToDay</h1>
    
    <p style="margin:0 0 24px 0;">
      Hi ${userName || 'there'},
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

  try {
    const html = wrapHtml(content, "Welcome");
    await resend.emails.send({
      from: `DayToDay <hello@nandeeshkhant.info>`,
      to: email,
      subject: "Welcome to your new vault",
      html,
    });
    console.log(`📧 Welcome email sent to ${email} at ${new Date().toISOString()}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Error sending welcome email:", error);
    return { success: false, error: error.message || String(error) };
  }
};

// ------------------------------------------------------
//  SEND LOGIN ALERT
// ------------------------------------------------------
export const sendLoginAlert = async (email, userName, deviceInfo) => {
  const resend = getResend();
  if (!resend) {
    console.log(`[Email Mock] Login alert for ${email}`);
    return { success: true };
  }

  const content = `
    <h1 style="margin:0 0 24px 0;font-size:24px;font-weight:600;color:#000000;letter-spacing:-0.5px;">New Sign-in Detected</h1>
    
    <p style="margin:0 0 32px 0;">
      A new device just signed in to your DayToDay account.
    </p>

    <div style="margin-bottom:32px;">
      <div style="margin-bottom:12px;display:flex;">
        <span style="font-weight:600;width:80px;color:#888888;">Device</span>
        <span style="color:#000000;">${deviceInfo?.os || 'Unknown'} &bull; ${deviceInfo?.browser || 'Unknown'}</span>
      </div>
      <div style="margin-bottom:12px;display:flex;">
        <span style="font-weight:600;width:80px;color:#888888;">Location</span>
        <span style="color:#000000;">${deviceInfo?.ip === '::1' ? 'Localhost' : (deviceInfo?.ip || 'Unknown')}</span>
      </div>
      <div style="display:flex;">
        <span style="font-weight:600;width:80px;color:#888888;">Time</span>
        <span style="color:#000000;">${new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })}</span>
      </div>
    </div>

    <p style="margin:0;font-size:13px;color:#666666;">
      If this wasn't you, please secure your account immediately.
    </p>
  `;

  try {
    const html = wrapHtml(content, "New Sign-in");
    await resend.emails.send({
      from: `DayToDay Security <security@nandeeshkhant.info>`,
      to: email,
      subject: "New login to your DayToDay account",
      html,
    });
    console.log(`🚨 Login Alert Sent to ${email} at ${new Date().toISOString()}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Error sending login alert:", error);
    return { success: false, error: error.message || String(error) };
  }
};

export default transporter;
