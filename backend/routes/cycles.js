const express = require("express");
const router = express.Router();
const Cycle = require("../models/Cycle");
const Subscriber = require("../models/Subscriber");
const Payment = require("../models/Payment");
const FinanceDay = require("../models/FinanceDay");
const { sendSms } = require("../services/sms");
const { requireRole } = require("../middleware/auth");

// جلب دورة واحدة (لصفحة الطباعة)
router.get("/:id", requireRole("admin", "accountant"), async (req, res) => {
  const cycle = await Cycle.findById(req.params.id).populate("subscriber");
  if (!cycle) return res.status(404).json({ error: "الفاتورة غير موجودة" });
  res.json(cycle);
});

// === تسجيل دفعة (تدعم الدفع الجزئي) ===
router.post("/:id/pay", requireRole("admin", "accountant"), async (req, res) => {
  try {
    const { amount } = req.body;
    const payment = Number(amount);
    if (!Number.isFinite(payment) || payment <= 0) {
      return res.status(400).json({ error: "مبلغ الدفع يجب أن يكون أكبر من صفر" });
    }
    const cycle = await Cycle.findById(req.params.id);
    if (!cycle) return res.status(404).json({ error: "الفاتورة غير موجودة" });

    const paid = (cycle.paidAmount || 0) + payment;
    const remaining = cycle.totalDue - paid;

    cycle.paidAmount = paid;
    cycle.remainingBalance = remaining;
    cycle.paymentDate = new Date();
    cycle.status = remaining <= 0 ? "paid" : "partial";
    await cycle.save();

    await Payment.create({
      cycle: cycle._id,
      subscriber: cycle.subscriber,
      subscriberId: cycle.subscriberId,
      amount: payment,
    });

    const dateKey = new Date().toISOString().slice(0, 10);
    await FinanceDay.findOneAndUpdate(
      { dateKey },
      { $inc: { dailyPaid: payment } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // إذا دفع الزبون أكثر من المطلوب، نحفظ الفرق كرصيد له ليُستفاد منه في الفواتير القادمة
    const subscriber = await Subscriber.findById(cycle.subscriber);
    if (subscriber) {
      const newBalance = remaining;
      subscriber.balance = newBalance;
      await subscriber.save();
    }

    let smsResult = null;
    if (subscriber && subscriber.smsEnabled && subscriber.phone) {
      smsResult = await sendSms({
        phone: subscriber.phone,
        subscriber: subscriber._id,
        subscriberId: subscriber.subscriberId,
        message: [
          `مرحباً ${subscriber.name}،`,
          "تم تسجيل دفعتك بنجاح.",
          `مبلغ الدفعة: ${payment}`,
          `إجمالي الحساب: ${cycle.totalDue}`,
          remaining > 0 ? `المتبقي عليك: ${remaining}` : remaining < 0 ? `رصيد لك: ${Math.abs(remaining)}` : "تم تسديد الحساب بالكامل.",
          "شكرا لك مولدات حمودة",
        ].join("\n"),
      });
    }

    res.json({
      ...cycle.toObject(),
      sms: smsResult
        ? { ok: smsResult.ok, error: smsResult.error || null, provider: smsResult.provider || null }
        : { ok: false, error: "لم يتم إرسال الرسالة: رقم الهاتف غير موجود أو SMS معطل", provider: null },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
