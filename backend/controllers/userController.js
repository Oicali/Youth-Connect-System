const express = require("express");
const userService = require("../services/userService");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");

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
    if (err.status) return res.status(err.status).json({ message: err.message, field: err.field });
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

router.get("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { search, role, status, page, limit } = req.query;
    const { rows, total } = await userService.listUsers({
      search, role, status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 15,
    });
    res.json({ users: rows, total });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("List users error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.put("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const updated = await userService.updateUser(req.params.id, req.body);
    res.json({ user: updated });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("Update user error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.patch("/:id/status", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await userService.setUserStatus(req.params.id, status);
    res.json({ user: updated });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("Set status error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.post("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const created = await userService.createUser(req.body);
    res.status(201).json({ user: created });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("Create user error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

module.exports = router;