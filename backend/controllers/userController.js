const express = require("express");
const userService = require("../services/userService");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
  try {
    const profile = await userService.getProfile(req.session.user.id);
    res.json({ user: profile });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("Get profile error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.put("/me", requireAuth, async (req, res) => {
  try {
    const updated = await userService.updateProfile(req.session.user.id, req.body);
    res.json({ user: updated });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.put("/me/password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Current and new password are required" });
  }

  try {
    await userService.changePassword(req.session.user.id, currentPassword, newPassword);
    res.json({ message: "Password updated" });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("Change password error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

module.exports = router;