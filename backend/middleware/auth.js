const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "غير مسموح: لم يتم إرسال رمز الدخول" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fatura-secret-key");
    const user = await User.findById(decoded.id).select("name username role phone active").lean();
    if (!user || !user.active) {
      return res.status(401).json({ error: "الحساب غير موجود أو معطل" });
    }
    req.user = decoded;
    req.user.name = user.name;
    req.user.username = user.username;
    req.user.role = user.role;
    next();
  } catch (err) {
    return res.status(401).json({ error: "رمز الدخول غير صالح" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "ليس لديك صلاحية للوصول" });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole };
