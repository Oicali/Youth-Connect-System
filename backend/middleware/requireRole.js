function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.session.user || !allowedRoles.includes(req.session.user.role)) {
      return res.status(403).json({ message: "You do not have permission to do this" });
    }
    next();
  };
}

module.exports = requireRole;