const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Admin OR team_member can access
const crmAccess = (req, res, next) => {
  if (!['admin', 'team_member'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};

// Admin OR team_member with financeAccess can access finance routes
const financeOrAdmin = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  if (req.user?.role === 'team_member' && req.user?.financeAccess === true) return next();
  return res.status(403).json({ message: 'Finance access required' });
};

// Admin OR product_manager can access product portal routes
const productAccess = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  if (req.user?.role === 'product_manager') return next();
  return res.status(403).json({ message: 'Product portal access required' });
};

module.exports = { protect, adminOnly, crmAccess, financeOrAdmin, productAccess };
