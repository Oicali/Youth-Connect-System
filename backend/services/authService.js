// backend/services/authService.js

const bcrypt = require("bcrypt");
const userRepository = require("../repositories/userRepository");

async function authenticate(username, password) {
  const user = await userRepository.findByUsername(username);

  if (!user) {
    throw { status: 401, message: "Invalid username or password" };
  }

  if (user.status === "locked") {
    throw { status: 403, message: "This account is locked. Contact an admin." };
  }
  if (user.status === "deactivated") {
    throw { status: 403, message: "This account has been deactivated." };
  }
  if (user.status === "unverified") {
    throw { status: 403, message: "This account is not yet verified." };
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    throw { status: 401, message: "Invalid username or password" };
  }

  return {
    id: user.user_id,
    username: user.username,
    role: user.role_name,
    firstName: user.first_name,
    lastName: user.last_name,
  };
}

module.exports = { authenticate };