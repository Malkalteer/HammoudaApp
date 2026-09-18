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
      paidBy: req.user.id,
      paidByName: req.user.name || req.user.username || "",
      paidByUsername: req.user.username || "",
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

    let smsQueued = false;
    if (subscriber && subscriber.smsEnabled && subscriber.phone) {
      smsQueued = true;
      void sendSms({
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
      }).catch((error) => {
        console.error("Failed to send payment SMS:", error.message);
      });
    }

    res.json({
      ...cycle.toObject(),
      sms: smsQueued
        ? { queued: true, provider: null }
        : { queued: false, error: "لم يتم إرسال الرسالة: رقم الهاتف غير موجود أو SMS معطل", provider: null },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// تعديل آخر دفعة في الدورة مع تصحيح إجمالي الدورة والمالية
router.put("/:id/last-payment", requireRole("admin"), async (req, res) => {
  try {
    const adjustment = Number(req.body.amount);
    if (!Number.isFinite(adjustment) || adjustment === 0) {
      return res.status(400).json({ error: "قيمة التصحيح يجب أن تكون موجبة أو سالبة وليست صفرًا" });
    }

    const cycle = await Cycle.findById(req.params.id);
    if (!cycle) return res.status(404).json({ error: "الفاتورة غير موجودة" });

    const payment = await Payment.findOne({ cycle: cycle._id }).sort({ paidAt: -1, createdAt: -1 });
    if (!payment) return res.status(404).json({ error: "لا توجد دفعة لتعديلها" });

    const previousAmount = Number(payment.amount || 0);
    const correctedAmount = previousAmount + adjustment;
    if (correctedAmount < 0) {
      return res.status(400).json({ error: "لا يمكن أن تصبح قيمة الدفعة أقل من صفر" });
    }
    payment.amount = correctedAmount;
    await payment.save();

    cycle.paidAmount = Number(cycle.paidAmount || 0) + adjustment;
    cycle.remainingBalance = cycle.totalDue - cycle.paidAmount;
    cycle.status = cycle.paidAmount <= 0
      ? "unpaid"
      : cycle.remainingBalance <= 0 ? "paid" : "partial";
    await cycle.save();

    const financeDateKey = new Date(payment.paidAt || payment.createdAt).toISOString().slice(0, 10);
    await FinanceDay.findOneAndUpdate(
      { dateKey: financeDateKey },
      { $inc: { dailyPaid: adjustment } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await Subscriber.findByIdAndUpdate(cycle.subscriber, { balance: cycle.remainingBalance });

    res.json({ ...cycle.toObject(), payment });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
