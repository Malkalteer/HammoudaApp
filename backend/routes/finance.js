const express = require("express");
const router = express.Router();
const Cycle = require("../models/Cycle");
const Payment = require("../models/Payment");
const FinanceDay = require("../models/FinanceDay");
const { requireRole } = require("../middleware/auth");

const getDateKey = (date = new Date()) => date.toISOString().slice(0, 10);

const getOrCreateDay = async (dateKey) =>
  FinanceDay.findOneAndUpdate(
    { dateKey },
    { $setOnInsert: { dateKey } },
    { new: true, upsert: true }
  );

router.get("/summary", requireRole("admin", "accountant"), async (req, res) => {
  try {
    const dateKey = req.query.date || getDateKey();
    const day = await getOrCreateDay(dateKey);
    const start = new Date(`${dateKey}T00:00:00.000Z`);
    const end = new Date(`${dateKey}T23:59:59.999Z`);

    const [invoices, paidToday, recentCycles, allCycles, cashOutDays] = await Promise.all([
      Cycle.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, currentInvoiceTotal: { $sum: "$invoiceAmount" } } },
      ]),
      Payment.aggregate([
        { $match: { paidAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Cycle.find({ createdAt: { $gte: start, $lte: end } }).sort({ createdAt: -1 }).populate("subscriber"),
      Cycle.find().sort({ createdAt: -1 }).populate("subscriber"),
      FinanceDay.find({ "cashOuts.0": { $exists: true } }).sort({ dateKey: -1 }).lean(),
    ]);

    const invoiceTotals = invoices[0] || { currentInvoiceTotal: 0 };
    const paid = paidToday[0] || { total: 0, count: 0 };
    const cashOut = Number(day.cashOut || 0);
    const previousBalance = Number(day.previousBalance || 0);
    const currentInvoiceTotal = Number(day.currentInvoiceTotal || invoiceTotals.currentInvoiceTotal || 0);
    // الصندوق العام هو مجموع الجمعة السابقة والجمعة الحالية فقط.
    // إخراج الدرج حركة نقدية منفصلة ولا يغيّر قيمة الصندوق العام.
    const generalFund = previousBalance + currentInvoiceTotal;
    const paidTotal = Number(day.dailyPaid || 0);

    res.json({
      dateKey,
      day,
      summary: {
        previousBalance,
        currentInvoiceTotal,
        generalFund,
        paidToday: paidTotal,
        remainingBalance: generalFund - paidTotal,
        paymentCount: paid.count,
        cashOut,
        cashDrawer: paidTotal - cashOut,
      },
      recentCycles,
      allCycles,
      cashOutOperations: cashOutDays.flatMap((financeDay) =>
        (financeDay.cashOuts || []).map((cashOut) => ({
          _id: cashOut._id,
          dateKey: financeDay.dateKey,
          amount: cashOut.amount,
          reason: cashOut.reason,
          createdAt: cashOut.createdAt,
        }))
      ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/cash-out", requireRole("admin", "accountant"), async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const reason = String(req.body.reason || "").trim();
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "مبلغ الخارج يجب أن يكون أكبر من صفر" });
    }
    if (!reason) {
      return res.status(400).json({ error: "يرجى إدخال سبب إخراج المبلغ" });
    }

    const dateKey = getDateKey();
    const day = await getOrCreateDay(dateKey);
    day.cashOut = Number(day.cashOut || 0) + amount;
    day.cashOuts.push({ amount, reason });
    await day.save();
    res.json(day);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/close-day", requireRole("admin", "accountant"), async (req, res) => {
  try {
    const dateKey = getDateKey();
    const day = await getOrCreateDay(dateKey);
    day.closedAt = new Date();
    await day.save();
    res.json({ message: "تم إقفال اليوم المالي", dateKey });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/daily-paid", requireRole("admin"), async (req, res) => {
  try {
    const days = await FinanceDay.find().sort({ dateKey: -1 }).limit(31).lean();
    res.json(days.map((day) => ({
      dateKey: day.dateKey,
      dailyPaid: Number(day.dailyPaid || 0),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, getDateKey, getOrCreateDay };
