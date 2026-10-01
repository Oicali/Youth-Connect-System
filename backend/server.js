// backend\server.js

const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const cors = require("cors");
require("dotenv").config();

const pool = require("./db");
const authRoutes = require("./controllers/authController");
const userRoutes = require("./controllers/userController");
const memberRoutes = require("./controllers/memberController");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true, // allows the session cookie to be sent cross-origin
}));

app.use(express.json());

app.use(session({
  store: new pgSession({
    pool,
    tableName: "session",
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // only HTTPS in prod
    sameSite: "lax",

  },
}));

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/members", memberRoutes);
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));