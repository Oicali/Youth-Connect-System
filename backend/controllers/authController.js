// backend/controllers/authController.js
const express = require("express");
const authService = require("../services/authService");

const router = express.Router();

// how long a "remember me" login lasts (7 days)
const REMEMBER_ME_MS = 1000 * 60 * 60 * 24 * 7;
// const REMEMBER_ME_MS = 1000 * 60;


router.post("/login", async (req, res) => {
  // read rememberMe from the request
  const { username, password, rememberMe } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  try {
    const sessionUser = await authService.authenticate(username, password);

    // new session ID on login (prevents session fixation)
    req.session.regenerate((regenErr) => {
      if (regenErr) {
        console.error("Session regenerate error:", regenErr);
        return res.status(500).json({ message: "Something went wrong. Please try again." });
      }

      req.session.user = sessionUser;

      // strict === true so only a real boolean true extends the session
      if (rememberMe === true) {
        req.session.cookie.maxAge = REMEMBER_ME_MS;
      }

      // save to Postgres before responding so the cookie is valid immediately
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Session save error:", saveErr);
          return res.status(500).json({ message: "Something went wrong. Please try again." });
        }
        res.json({ user: sessionUser });
      });
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error("Login error:", err);
    res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ message: "Could not log out" });
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out" });
  });
});

// router.get("/me", me);
// function me(req, res) {
//   if (!req.session.user) {
//     return res.status(401).json({ message: "Not logged in" });
//   }
//   res.json({ user: req.session.user });
// }
module.exports = router;
