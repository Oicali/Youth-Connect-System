// backend\services\userService.js
const bcrypt = require("bcrypt");
const userRepository = require("../repositories/userRepository");

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

  const passwordHash = await bcrypt.hash(fields.password, 10);

  try {
    return await userRepository.create({ ...fields, password: passwordHash });
  } catch (err) {
    if (err.code === "23505") {
      const field = err.constraint?.includes("username") ? "username"
        : err.constraint?.includes("email") ? "email"
        : err.constraint?.includes("phone") ? "phone"
        : null;
      throw { status: 409, message: `${field ? field.charAt(0).toUpperCase() + field.slice(1) : "A field"} is already in use`, field };
    }
    throw err;
  }
}

module.exports = { getProfile, updateProfile, changePassword, listUsers, updateUser, setUserStatus, createUser };