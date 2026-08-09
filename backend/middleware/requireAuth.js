function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Not logged in" });
  }
  next();
}

module.exports = requireAuth;