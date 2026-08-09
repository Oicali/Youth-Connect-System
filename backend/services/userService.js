const bcrypt = require("bcrypt");
const userRepository = require("../repositories/userRepository");

async function getProfile(userId) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw { status: 404, message: "User not found" };
  }
  return user;
}

async function updateProfile(userId, fields) {
  return userRepository.updateProfile(userId, fields);
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

module.exports = { getProfile, updateProfile, changePassword };