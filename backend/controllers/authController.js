// backend/controllers/authController.js
const express = require("express");
const authService = require("../services/authService");
// password reset logic and per-IP request limits
const passwordResetService = require("../services/passwordResetService");
const rateLimit = require("express-rate-limit");

const router = express.Router();

// max 5 reset emails per IP per 15 minutes (stops inbox spamming)
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

// max 10 reset attempts per IP per 15 minutes (stops token guessing)
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." },
});

// max 10 failed logins per IP per 15 minutes (slows password guessing)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true, // only failed attempts count
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again later." },
});

// how long a "remember me" login lasts (7 days)
const REMEMBER_ME_MS = 1000 * 60 * 60 * 24 * 7;
// const REMEMBER_ME_MS = 1000 * 60;


router.post("/login", loginLimiter, async (req, res) => {
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
         res.clearCookie("connect.sid", {
       httpOnly: true,
       secure: process.env.NODE_ENV === "production",
       sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
     });
    res.json({ message: "Logged out" });
  });
});

// request a reset link; always returns the same message so emails can't be probed
router.post("/forgot-password", forgotPasswordLimiter, (req, res) => {
  const { email } = req.body;

  if (typeof email !== "string" || !email.trim()) {
    return res.status(400).json({ message: "Email is required" });
  }

  // not awaited on purpose: response time can't reveal whether the email exists
  passwordResetService.requestPasswordReset(email.trim()).catch((err) => {
    console.error("Forgot password error:", err);
  });

  res.json({ message: "If an account exists for that email, a reset link has been sent." });
});

// set a new password using the token from the email link
router.post("/reset-password", resetPasswordLimiter, async (req, res) => {
  const { token, password } = req.body;

  try {
    await passwordResetService.resetPassword(token, password);
    res.json({ message: "Password updated" });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

module.exports = router;
