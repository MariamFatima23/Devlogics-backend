const nodemailer = require('nodemailer');

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const isConfigured =
  EMAIL_USER &&
  EMAIL_USER !== 'your_gmail@gmail.com' &&
  EMAIL_PASS &&
  EMAIL_PASS !== 'your_gmail_app_password';

let transporter = null;

if (isConfigured) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS.replace(/\s/g, ''), // remove spaces from App Password if any
    },
  });

  // Verify on startup
  transporter.verify((err) => {
    if (err) {
      console.error('❌ Email transporter error:', err.message);
      console.error('   Check EMAIL_USER and EMAIL_PASS in .env');
    } else {
      console.log('✅ Email transporter ready →', EMAIL_USER);
    }
  });
} else {
  console.warn('⚠️  Email not configured. Reset links will be printed to console.');
  console.warn('   Set EMAIL_USER and EMAIL_PASS in backend/.env to send real emails.');
}

/* ── Send reset email ─────────────────────────────────────── */
const sendResetEmail = async (toEmail, resetToken, userName) => {
  const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${FRONTEND}/reset-password/${resetToken}`;

  // DEV fallback — no credentials configured
  if (!transporter) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧  PASSWORD RESET  (dev mode — email NOT sent)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👤  To   : ${userName} <${toEmail}>`);
    console.log(`🔗  Link : ${resetUrl}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return;
  }

  // PRODUCTION — send real Gmail
  await transporter.sendMail({
    from:    `"DevLogics E-Portal" <${EMAIL_USER}>`,
    to:      toEmail,
    subject: '🔐 Reset Your Password — DevLogics E-Portal',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#04065c,#0077b6);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
          <h1 style="margin:0 0 6px;color:#fff;font-size:22px;font-weight:800;">🔐 Reset Your Password</h1>
          <p style="margin:0;color:rgba(255,255,255,0.7);font-size:13px;">DevLogics E-Portal</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:32px;border-radius:0 0 16px 16px;">
          <p style="color:#1f2937;font-size:15px;margin:0 0 12px;">Hi <strong>${userName}</strong>,</p>
          <p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0 0 24px;">
            We received a request to reset the password for your E-Portal account.
            Click the button below to set a new password. This link will expire in <strong>1 hour</strong>.
          </p>

          <!-- Button -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:8px 0 28px;">
              <a href="${resetUrl}"
                style="display:inline-block;background:linear-gradient(135deg,#0077b6,#04065c);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;">
                Reset My Password
              </a>
            </td></tr>
          </table>

          <!-- Fallback link -->
          <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0 0 8px;">
            Button not working? Copy this link into your browser:
          </p>
          <p style="text-align:center;margin:0 0 24px;">
            <a href="${resetUrl}" style="color:#0077b6;font-size:12px;word-break:break-all;">${resetUrl}</a>
          </p>

          <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 20px;"/>
          <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
            If you didn't request a password reset, no action is needed — your password is still the same.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px;text-align:center;">
          <p style="color:#9ca3af;font-size:11px;margin:0;">
            © ${new Date().getFullYear()} DevLogics E-Portal. All rights reserved.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
    `,
  });

  console.log(`✅ Reset email sent to ${toEmail}`);
};

module.exports = { sendResetEmail };
