const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const router = express.Router();
const User = require("../models/User");
const { authMiddleware, requireRole } = require("../middleware/auth");

router.post("/register", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { name, username, password, role, phone } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ error: "الاسم والمستخدم وكلمة المرور مطلوبة" });
    }

    const exists = await User.findOne({ username: username.toLowerCase() });
    if (exists) {
      return res.status(400).json({ error: "اسم المستخدم موجود بالفعل" });
    }

    if (!["admin", "accountant", "electrician"].includes(role)) {
      return res.status(400).json({ error: "الدور غير صالح" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      username: username.toLowerCase(),
      password: passwordHash,
      role,
      phone: phone || "",
    });

    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/users", authMiddleware, requireRole("admin"), async (req, res) => {
  const users = await User.find().select("-password").sort({ createdAt: 1 });
  res.json(users);
});

router.put("/users/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { name, role, active, phone } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (active !== undefined) updates.active = Boolean(active);
    if (role !== undefined) {
      if (!["admin", "accountant", "electrician"].includes(role)) {
        return res.status(400).json({ error: "الدور غير صالح" });
      }
      updates.role = role;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select("-password");
    if (!user) return res.status(404).json({ error: "الحساب غير موجود" });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username: String(username || "").toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    }

    if (!user.active) {
      return res.status(403).json({ error: "هذا الحساب معطل" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "كلمة المرور غير صحيحة" });
    }

    const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET || "fatura-secret-key", { expiresIn: "7d" });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
