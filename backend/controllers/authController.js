// backend/controllers/authController.js
const express = require("express");
const authService = require("../services/authService");

const router = express.Router();

async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  try {
    const sessionUser = await authService.authenticate(username, password);
    req.session.user = sessionUser;
    res.json({ user: sessionUser });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error("Login error:", err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
}

function logout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ message: "Could not log out" });
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out" });
  });
}

function me(req, res) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Not logged in" });
  }
  res.json({ user: req.session.user });
}

router.post("/login", login);
router.post("/logout", logout);
router.get("/me", me);

module.exports = router;