// backend/utils/emailTemplates.js

const APP_NAME = "Youth Connect System"; // shown in the header and footer

// hex copies of the app theme in index.css (email clients can't read oklch or CSS variables)
const COLORS = {
  primary: "#ec9f07", // --primary
  primaryDeep: "#d26800", // --primary-deep
  primaryText: "#140b05", // --primary-foreground (text on gold)
  pageBg: "#fbf9ed", // --background
  card: "#fffef5", // --card
  text: "#221812", // --foreground
  muted: "#5e534a", // --muted-foreground
  border: "#dcd7c9", // --border
  link: "#d26800", // fallback link color
};

// escapes user-provided text so a name can't inject HTML into the email
function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// builds subject, plain-text, and HTML versions of the reset email
function resetPasswordEmail({ firstName, link, expiresInMinutes }) {
  const name = escapeHtml(firstName || "there");
  const safeLink = escapeHtml(link);
  const subject = `Reset your ${APP_NAME} password`;
  const font = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  const text = [
    `Hi ${firstName || "there"},`,
    ``,
    `We received a request to reset your ${APP_NAME} password.`,
    `Open this link to choose a new one (valid for ${expiresInMinutes} minutes, one use only):`,
    ``,
    link,
    ``,
    `If you didn't request this, you can ignore this email. Your password won't change.`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.pageBg};">
  <!-- preheader: the preview text shown next to the subject in the inbox -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Use this link to choose a new password. It expires in ${expiresInMinutes} minutes.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.pageBg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:${COLORS.card};border-radius:12px;overflow:hidden;">

          <!-- header bar: gold gradient (Outlook falls back to solid gold) -->
          <tr>
            <td style="background-color:${COLORS.primary};background-image:linear-gradient(180deg,${COLORS.primaryDeep},${COLORS.primary});padding:24px 32px;font-family:${font};font-size:20px;font-weight:700;color:${COLORS.primaryText};">
              ${APP_NAME}
            </td>
          </tr>

          <!-- body -->
          <tr>
            <td style="padding:32px;font-family:${font};color:${COLORS.text};">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:28px;color:${COLORS.text};">Reset your password</h1>
              <p style="margin:0 0 12px;font-size:15px;line-height:24px;">Hi ${name},</p>
              <p style="margin:0;font-size:15px;line-height:24px;">
                We received a request to reset your password. Click the button below to choose a new one.
              </p>

              <!-- button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td style="background-color:${COLORS.primary};border-radius:8px;">
                    <a href="${safeLink}" style="display:inline-block;padding:14px 28px;font-family:${font};font-size:15px;font-weight:600;color:${COLORS.primaryText};text-decoration:none;">
                      Reset password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 20px;font-size:13px;line-height:20px;color:${COLORS.muted};">
                This link expires in ${expiresInMinutes} minutes and can only be used once.
              </p>

              <!-- fallback for when the button doesn't work -->
              <p style="margin:0 0 20px;font-size:13px;line-height:20px;color:${COLORS.muted};">
                Button not working? Copy and paste this link into your browser:<br>
                <a href="${safeLink}" style="color:${COLORS.link};text-decoration:underline;word-break:break-all;">${safeLink}</a>
              </p>

              <hr style="border:none;border-top:1px solid ${COLORS.border};margin:24px 0;">

              <p style="margin:0;font-size:13px;line-height:20px;color:${COLORS.muted};">
                If you didn't request this, you can safely ignore this email. Your password won't change.
              </p>
            </td>
          </tr>
        </table>

        <!-- footer -->
        <p style="max-width:520px;margin:16px 0 0;font-family:${font};font-size:12px;line-height:18px;color:${COLORS.muted};text-align:center;">
          You received this email because a password reset was requested for your ${APP_NAME} account.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

module.exports = { resetPasswordEmail };