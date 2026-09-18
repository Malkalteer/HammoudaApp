const express = require("express");
const router = express.Router();
const { requireRole } = require("../middleware/auth");
const Setting = require("../models/Setting");
const Subscriber = require("../models/Subscriber");

router.get("/kwh-price", requireRole("admin"), async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: "kwhPrice" });
    res.json({ key: "kwhPrice", value: Number(setting?.value ?? 1) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/kwh-price", requireRole("admin"), async (req, res) => {
  try {
    const value = Number(req.body?.value);
    if (!Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ error: "سعر الكيلو الواط يجب أن يكون رقمًا أكبر من صفر" });
    }

    const setting = await Setting.findOneAndUpdate(
      { key: "kwhPrice" },
      { $set: { value, description: "سعر الكيلو الواط" } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ key: setting.key, value: Number(setting.value) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/custom-prices", requireRole("admin"), async (req, res) => {
  try {
    const subscribers = await Subscriber.find({ customUnitPrice: { $ne: null } })
      .select("name subscriberId panelNumber customUnitPrice")
      .sort({ subscriberId: 1 });
    res.json(subscribers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/custom-prices/:id", requireRole("admin"), async (req, res) => {
  try {
    const rawValue = req.body?.value;
    const value = rawValue === null || rawValue === "" ? null : Number(rawValue);
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      return res.status(400).json({ error: "السعر الخاص يجب أن يكون رقمًا أكبر من صفر" });
    }

    const subscriber = await Subscriber.findByIdAndUpdate(
      req.params.id,
      { customUnitPrice: value },
      { new: true, runValidators: true }
    ).select("name subscriberId panelNumber customUnitPrice");
    if (!subscriber) return res.status(404).json({ error: "المشترك غير موجود" });
    res.json(subscriber);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/sms-gateway", requireRole("admin"), async (req, res) => {
  try {
    const [url, token] = await Promise.all([
      Setting.findOne({ key: "smsGatewayUrl" }),
      Setting.findOne({ key: "smsGatewayToken" }),
    ]);
    res.json({ url: String(url?.value || ""), token: String(token?.value || "") });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/sms-gateway", requireRole("admin","accountant"), async (req, res) => {
  try {
    const url = String(req.body?.url || "").trim().replace(/\/$/, "");
    const token = String(req.body?.token || "").trim();
    if (!url || !token) {
      return res.status(400).json({ error: "يرجى إدخال رابط بوابة SMS والـ Token" });
    }
    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: "رابط بوابة SMS يجب أن يبدأ بـ http:// أو https://" });
    }

    await Promise.all([
      Setting.findOneAndUpdate(
        { key: "smsGatewayUrl" },
        { $set: { value: url, description: "رابط بوابة SMS" } },
        { upsert: true, setDefaultsOnInsert: true }
      ),
      Setting.findOneAndUpdate(
        { key: "smsGatewayToken" },
        { $set: { value: token, description: "Token بوابة SMS" } },
        { upsert: true, setDefaultsOnInsert: true }
      ),
    ]);
    res.json({ message: "تم حفظ إعدادات بوابة SMS" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
