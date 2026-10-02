function requireRole(allowedRoles) {
  // accept a single role or an array, so includes() is always an array lookup
  const roles = [].concat(allowedRoles);

  return (req, res, next) => {
    // no session → 401 so the frontend can redirect to login
    if (!req.session.user) {
      return res.status(401).json({ message: "Not logged in" });
    }

    // logged in but role not allowed → 403
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ message: "You do not have permission to do this" });
    }

    next();
  };
}

module.exports = requireRole;