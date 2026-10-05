const express = require("express");
const dashboardService = require("../services/dashboardService");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.get("/summary", requireAuth, async (req, res) => {
  try {
    res.json(await dashboardService.getSummary());
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("Dashboard summary error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.get("/history", requireAuth, async (req, res) => {
  try {
    const year = Number.parseInt(req.query.year, 10); // junk becomes NaN, which the service rejects with a 400
    res.json(await dashboardService.getHistory(year));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("Dashboard history error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

module.exports = router;