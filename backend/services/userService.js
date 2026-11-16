// backend\services\userService.js
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const userRepository = require("../repositories/userRepository");
const passwordResetService = require("./passwordResetService");

const cleanForUsername = (s) =>
  String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// "Juan Dela Cruz" -> "juan.delacruz"; capped so a counter still fits in varchar(50)
function buildUsernameBase(firstName, lastName) {
  const first = cleanForUsername(firstName);
  const last = cleanForUsername(lastName);
  const base = first && last ? `${first}.${last}` : first || last || "user";
  return base.slice(0, 40);
}

async function getProfile(userId) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw { status: 404, message: "User not found" };
  }
  return user;
}

async function checkPhoneConflicts(phone, altPhone, excludeUserId = null) {
  const conflicts = await userRepository.findPhoneConflict(phone, altPhone, excludeUserId);
  if (conflicts.length === 0) return;

  const conflict = conflicts[0];
  if (conflict.phone === phone || conflict.alt_phone === phone) {
    throw { status: 409, message: "This phone number is already registered to another user", field: "phone" };
  }
  throw { status: 409, message: "This phone number is already registered to another user", field: "alt_phone" };
}

async function updateProfile(userId, fields) {
  await checkPhoneConflicts(fields.phone, fields.alt_phone, userId);

  try {
    return await userRepository.updateProfile(userId, fields);
  } catch (err) {
    if (err.code === "23505") {
      const field = err.constraint?.includes("email") ? "email"
        : err.constraint?.includes("phone") ? "phone"
        : null;
      throw { status: 409, message: `This ${field || "value"} is already in use`, field };
    }
    throw err;
  }
}

async function changePassword(userId, currentPassword, newPassword) {
  const currentHash = await userRepository.findPasswordById(userId);
  if (!currentHash) {
    throw { status: 404, message: "User not found" };
  }

  const matches = await bcrypt.compare(currentPassword, currentHash);
  if (!matches) {
    throw { status: 401, message: "Current password is incorrect" };
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await userRepository.updatePassword(userId, newHash);
}

async function listUsers(filters) {
  return userRepository.findAll(filters);
}

async function updateUser(userId, fields) {
  await checkPhoneConflicts(fields.phone, fields.alt_phone, userId);

  const updated = await userRepository.updateById(userId, fields);
  if (!updated) {
    throw { status: 404, message: "User not found" };
  }
  return updated;
}

async function setUserStatus(userId, status) {
  const validStatuses = ["active", "deactivated"];
  if (!validStatuses.includes(status)) {
    throw { status: 400, message: "Invalid status" };
  }
  const updated = await userRepository.setStatus(userId, status);
  if (!updated) {
    throw { status: 404, message: "User not found" };
  }
  return updated;
}

async function createUser(fields) {
  await checkPhoneConflicts(fields.phone, fields.alt_phone, null);

  // nobody ever sees this password: the user replaces it through the emailed link
  const placeholderHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
  const base = buildUsernameBase(fields.first_name, fields.last_name);

  let created = null;
  for (let n = 1; n <= 20 && !created; n++) {
    const username = n === 1 ? base : `${base}${n}`;
    try {
      // client-sent username/password are overridden on purpose
      created = await userRepository.create({ ...fields, username, password: placeholderHash });
    } catch (err) {
      if (err.code !== "23505") throw err;
      if (err.constraint?.includes("username")) continue; // taken (or lost a race): try the next number
      const field = err.constraint?.includes("email") ? "email"
        : err.constraint?.includes("phone") ? "phone"
        : null;
      throw { status: 409, message: `${field ? field.charAt(0).toUpperCase() + field.slice(1) : "A field"} is already in use`, field };
    }
  }
  if (!created) throw { status: 500, message: "Could not generate a username" };

  // the account exists either way; a failed email shouldn't undo it
  let emailSent = true;
  try {
    await passwordResetService.sendWelcomeEmail({
      userId: created.user_id,
      email: created.email,
      firstName: created.first_name,
      username: created.username,
    });
  } catch (err) {
    console.error("Welcome email failed:", err);
    emailSent = false;
  }

  return { ...created, emailSent };
}

// one resend per user per minute; in-memory, so it resets on restart and isn't shared across servers
const lastResend = new Map();
const RESEND_COOLDOWN_MS = 60 * 1000;

async function resendInvite(userId) {
  const user = await userRepository.findForInvite(userId);
  if (!user) throw { status: 404, message: "User not found" };
  if (user.status !== "active") throw { status: 400, message: "Reactivate this user before sending an invite" };
  if (user.password_set_at) throw { status: 400, message: "This user has already set their password" };

  const last = lastResend.get(userId) || 0;
  if (Date.now() - last < RESEND_COOLDOWN_MS) {
    throw { status: 429, message: "Invite was just sent. Wait a minute before resending." };
  }

  try {
    await passwordResetService.sendWelcomeEmail({
      userId: user.user_id,
      email: user.email,
      firstName: user.first_name,
      username: user.username,
    });
  } catch (err) {
    console.error("Resend invite failed:", err);
    throw { status: 502, message: "Could not send the email. Check the address and try again." };
  }
  lastResend.set(userId, Date.now()); // only start the cooldown after a successful send
}

module.exports = { getProfile, updateProfile, changePassword, listUsers, updateUser, setUserStatus, createUser, resendInvite };