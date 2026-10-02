// backend/services/passwordResetService.js
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const userRepository = require("../repositories/userRepository");
const passwordResetRepository = require("../repositories/passwordResetRepository");
const sessionRepository = require("../repositories/sessionRepository");
const { sendEmail } = require("../utils/mailer");
const { resetPasswordEmail } = require("../utils/emailTemplates");

const TOKEN_TTL_MINUTES = 30; // how long a reset link stays valid
const SALT_ROUNDS = 10; // must match what you use when creating users

// SHA-256 of the token, hex encoded (matches the character(64) column)
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// step 1: create a token and email the link (silent if the account doesn't qualify)
async function requestPasswordReset(email) {
  const user = await userRepository.findByEmail(email);
  if (!user || user.status !== "active") return;

  const rawToken = crypto.randomBytes(32).toString("hex");

  // only the newest link should work
  await passwordResetRepository.deleteByUserId(user.user_id);
  await passwordResetRepository.create({
    userId: user.user_id,
    tokenHash: hashToken(rawToken),
    ttlMinutes: TOKEN_TTL_MINUTES,
  });

  const link = `${process.env.CLIENT_URL}/reset-password?token=${rawToken}`;

  // build the branded email, with a plain-text fallback
  const { subject, text, html } = resetPasswordEmail({
    firstName: user.first_name,
    link,
    expiresInMinutes: TOKEN_TTL_MINUTES,
  });

  await sendEmail({ to: user.email, subject, text, html });
}

// step 2: validate the token, save the new password, log the user out everywhere
async function resetPassword(token, newPassword) {
  // check the password BEFORE consuming the token, or a bad password burns the link
  if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 72) {
    throw { status: 400, message: "Password must be between 8 and 72 characters." };
  }
  if (typeof token !== "string" || !token) {
    throw { status: 400, message: "This reset link is invalid or has expired." };
  }

  // atomically marks the token used and returns its user, or null
  const userId = await passwordResetRepository.consume(hashToken(token));
  if (!userId) {
    throw { status: 400, message: "This reset link is invalid or has expired." };
  }

  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await userRepository.updatePassword(userId, hash);

  // clear leftover tokens and kill every login session for this user
  await passwordResetRepository.deleteByUserId(userId);
  await sessionRepository.deleteByUserId(userId);
}

module.exports = { requestPasswordReset, resetPassword };