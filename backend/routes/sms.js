const express = require("express");
const router = express.Router();
const { requireRole } = require("../middleware/auth");
const SmsLog = require("../models/SmsLog");
const { sendSms } = require("../services/sms");

router.get("/logs", requireRole("admin", "accountant"), async (req, res) => {
  const logs = await SmsLog.find().sort({ createdAt: -1 }).limit(50);
  res.json(logs);
});

router.post("/send", requireRole("admin", "accountant"), async (req, res) => {
  try {
    const { phone, message, subscriberId, subscriber } = req.body;
    const result = await sendSms({ phone, message, subscriberId, subscriber });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
