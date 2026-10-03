//backend\controllers\memberController.js

const express = require("express");
const memberService = require("../services/memberService");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const { search, role, connectionStatus, gender, addedYear, addedMonth, page, limit } = req.query;
    const { rows, total } = await memberService.listMembers({
      search, role, connectionStatus, gender,
      addedYear: addedYear ? Number(addedYear) : undefined,
      addedMonth: addedMonth ? Number(addedMonth) : undefined,
      page: page ? Number(page) : 1,
      // cap page size so ?limit=100000 can't dump the whole table
      limit: limit ? Math.min(Number(limit), 100) : 15,
    });
    res.json({ members: rows, total });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("List members error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// must stay ABOVE "/:id", or Express matches "duplicates" as an id
router.get("/duplicates", requireAuth, async (req, res) => {
  try {
    const { first_name, last_name, exclude_id } = req.query;
    const excludeId = Number.parseInt(exclude_id, 10) || null; // junk or missing value becomes null
    const members = await memberService.findDuplicates(first_name, last_name, excludeId);
    res.json({ members });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("Find duplicates error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const member = await memberService.getMember(req.params.id);
    res.json({ member });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("Get member error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.post("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const created = await memberService.createMember(req.body);
    res.status(201).json({ member: created });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message, field: err.field });
    console.error("Create member error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.put("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const updated = await memberService.updateMember(req.params.id, req.body);
    res.json({ member: updated });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message, field: err.field });
    console.error("Update member error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.patch("/:id/status", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { member_status, cascade_unassign_mentees } = req.body;
    const updated = await memberService.setMemberStatus(req.params.id, member_status, {
      cascadeUnassignMentees: !!cascade_unassign_mentees,
    });
    res.json({ member: updated });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("Set member status error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.post("/:id/mentor", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { mentor_id } = req.body;
    const updated = await memberService.assignMentor(req.params.id, mentor_id);
    res.json({ member: updated });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message, field: err.field });
    console.error("Assign mentor error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.delete("/:id/mentor", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const updated = await memberService.unassignMentor(req.params.id);
    res.json({ member: updated });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("Unassign mentor error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.post("/:id/join-care-group", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { mentor_id } = req.body;
    const updated = await memberService.joinCareGroup(req.params.id, mentor_id);
    res.json({ member: updated });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message, field: err.field });
    console.error("Join care group error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.post("/:id/connector", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { connector_id } = req.body;
    const updated = await memberService.assignConnector(req.params.id, connector_id);
    res.json({ member: updated });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("Assign connector error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.delete("/:id/connector", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const updated = await memberService.unassignConnector(req.params.id);
    res.json({ member: updated });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("Unassign connector error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.post("/:id/connection/remove", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const updated = await memberService.markConnectionRemoved(req.params.id);
    res.json({ member: updated });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("Mark connection removed error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

module.exports = router;