import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

// Compatibility transporter object (keeps existing usage)
const transporter = {
  verify: (cb) => cb(null, true),
};

transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email transporter error:", error);
  } else {
    console.log("✅ Resend email service is ready to send messages");
  }
});

// Helper: wrap HTML in a complete email document (keeps templates consistent)
const wrapHtml = (innerHtml) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <title>Email</title>
  </head>
  <body style="margin:0;padding:0;background-color:#111111;">
    ${innerHtml}
  </body>
</html>`;

// ------------------------------------------------------
//  SEND 2FA CODE EMAIL
// ------------------------------------------------------
export const send2FACode = async (email, code, userName) => {
  // Professional black & white template (table-based, inline styles)
  const html = wrapHtml(`
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;width:100%;min-width:320px;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <!-- container -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;">
          <!-- Header -->
          <tr>
            <td style="background:#000000;padding:28px 24px;text-align:center;color:#ffffff;">
              <h1 style="margin:0;font-size:20px;font-weight:600;letter-spacing:0.2px;">Auth System</h1>
              <div style="margin-top:6px;font-size:12px;color:#cfcfcf;">Two-Factor Authentication</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 28px 20px 28px;color:#111111;">
              <p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;color:#222222;">
                Hi <strong style="font-weight:600;">${userName}</strong>,
              </p>

              <p style="margin:0 0 18px 0;font-size:14px;color:#333333;line-height:1.5;">
                Use the verification code below to sign in. This code will expire in <strong>10 minutes</strong>.
              </p>

              <!-- Code box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;padding:18px 28px;border-radius:8px;border:1px solid #e8e8e8;background:#fbfbfb;">
                      <span style="font-family: 'Courier New', monospace;font-size:28px;letter-spacing:6px;color:#000000;font-weight:700;">${code}</span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 12px 0;font-size:13px;color:#666666;line-height:1.5;">
                If you did not request this, you can safely ignore this email — no changes were made to your account.
              </p>

              <div style="margin-top:18px;padding:12px;border-left:4px solid #e0e0e0;background:#fafafa;border-radius:6px;font-size:13px;color:#555555;">
                <strong>Security tip:</strong> Never share your code with anyone.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fafafa;padding:18px 24px;text-align:center;color:#555555;font-size:12px;">
              <div style="max-width:540px;margin:0 auto;">
                <div style="margin-bottom:6px;color:#777777;">This is an automated message. Please do not reply.</div>
                <div style="color:#999999;">&copy; ${new Date().getFullYear()} Auth System</div>
              </div>
            </td>
          </tr>
        </table>
        <!-- end container -->
      </td>
    </tr>
  </table>
  `);

  try {
    await resend.emails.send({
      from: `Auth System <hello@nandeeshkhant.info>`,
      to: email,
      subject: "Your verification code — Auth System",
      html,
    });
    return { success: true };
  } catch (error) {
    console.error("Error sending 2FA email:", error);
    return { success: false, error: error.message || String(error) };
  }
};

// ------------------------------------------------------
//  SEND WELCOME EMAIL
// ------------------------------------------------------
export const sendWelcomeEmail = async (email, userName) => {
  const html = wrapHtml(`
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;width:100%;min-width:320px;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;">
          <tr>
            <td style="background:#000000;padding:28px 24px;text-align:center;color:#ffffff;">
              <h1 style="margin:0;font-size:20px;font-weight:600;">Welcome to Auth System</h1>
              <div style="margin-top:6px;font-size:12px;color:#cfcfcf;">Secure accounts. Smooth experience.</div>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 28px 18px 28px;color:#111111;">
              <p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;color:#222222;">
                Hello <strong style="font-weight:600;">${userName}</strong>,
              </p>

              <p style="margin:0 0 16px 0;font-size:14px;color:#333333;line-height:1.5;">
                Thanks for creating an account with Auth System. We're happy to have you onboard.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 24px 0;">
                <tr>
                  <td style="padding:0 0 8px 0;">
                    <div style="display:flex;gap:10px;align-items:flex-start;">
                      <div style="min-width:44px;height:44px;border-radius:8px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;font-weight:700;color:#000000;font-size:18px;">
                        ✓
                      </div>
                      <div style="flex:1;">
                        <div style="font-size:14px;font-weight:600;color:#111111;margin-bottom:4px;">Two-factor authentication</div>
                        <div style="font-size:13px;color:#666666;line-height:1.4;">Add an extra layer of protection to your account.</div>
                      </div>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:12px 0 8px 0;">
                    <div style="display:flex;gap:10px;align-items:flex-start;">
                      <div style="min-width:44px;height:44px;border-radius:8px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;font-weight:700;color:#000000;font-size:18px;">
                        🔒
                      </div>
                      <div style="flex:1;">
                        <div style="font-size:14px;font-weight:600;color:#111111;margin-bottom:4px;">Session & device security</div>
                        <div style="font-size:13px;color:#666666;line-height:1.4;">Manage where you're signed in and end sessions remotely.</div>
                      </div>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:12px 0 0 0;">
                    <div style="display:flex;gap:10px;align-items:flex-start;">
                      <div style="min-width:44px;height:44px;border-radius:8px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;font-weight:700;color:#000000;font-size:18px;">
                        ⚙️
                      </div>
                      <div style="flex:1;">
                        <div style="font-size:14px;font-weight:600;color:#111111;margin-bottom:4px;">Developer friendly</div>
                        <div style="font-size:13px;color:#666666;line-height:1.4;">APIs and SDKs to integrate Auth System quickly.</div>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px 0;font-size:14px;color:#333333;">If you need help getting started, reply to this email or visit our docs.</p>
            </td>
          </tr>

          <tr>
            <td style="background:#fafafa;padding:18px 24px;text-align:center;color:#555555;font-size:12px;">
              <div style="margin-bottom:6px;color:#777777;">This is an automated message. Please do not reply.</div>
              <div style="color:#999999;">&copy; ${new Date().getFullYear()} Auth System</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  `);

  try {
    await resend.emails.send({
      from: `Auth System <hello@nandeeshkhant.info>`,
      to: email,
      subject: "Welcome to Auth System!",
      html,
    });
    return { success: true };
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return { success: false, error: error.message || String(error) };
  }
};

export default transporter;
