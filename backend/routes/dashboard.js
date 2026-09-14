const express = require("express");
const router = express.Router();
const Subscriber = require("../models/Subscriber");
const Cycle = require("../models/Cycle");
const Payment = require("../models/Payment");
const FinanceDay = require("../models/FinanceDay");
const XLSX = require("xlsx");
const { authMiddleware, requireRole } = require("../middleware/auth");

router.get("/summary", authMiddleware, requireRole("admin", "accountant"), async (req, res) => {
  try {
    const [totalSubscribers, connected, disconnected, totalBalance, paidCycles, unpaidCycles, partialCycles] = await Promise.all([
      Subscriber.countDocuments(),
      Subscriber.countDocuments({ connectionStatus: "متصل" }),
      Subscriber.countDocuments({ connectionStatus: "مقطوع" }),
      Subscriber.aggregate([{ $group: { _id: null, total: { $sum: "$balance" } } }]),
      Cycle.countDocuments({ status: "paid" }),
      Cycle.countDocuments({ status: "unpaid" }),
      Cycle.countDocuments({ status: "partial" }),
    ]);

    const summary = {
      totalSubscribers,
      connected,
      disconnected,
      totalBalance: totalBalance[0]?.total || 0,
      paidCycles,
      unpaidCycles,
      partialCycles,
    };

    const overdue = await Subscriber.find({ balance: { $gt: 0 } }).sort({ balance: -1 }).limit(10);
    const recent = await Cycle.find().sort({ createdAt: -1 }).limit(5).populate("subscriber");

    res.json({ summary, overdue, recent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/export-excel", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const [subscribers, cycles, payments, financeDays] = await Promise.all([
      Subscriber.find().sort({ subscriberId: 1 }).lean(),
      Cycle.find().sort({ createdAt: 1 }).lean(),
      Payment.find().sort({ paidAt: 1 }).lean(),
      FinanceDay.find().sort({ dateKey: 1 }).lean(),
    ]);

    const latestCycleBySubscriber = new Map();
    cycles.forEach((cycle) => latestCycleBySubscriber.set(String(cycle.subscriber), cycle));
    const subscriberById = new Map(
      subscribers.map((subscriber) => [String(subscriber._id), subscriber])
    );
    const cycleById = new Map(cycles.map((cycle) => [String(cycle._id), cycle]));
    const normalize = (value) => ({
      ...value,
      _id: value._id ? String(value._id) : "",
      subscriber: value.subscriber ? String(value.subscriber) : "",
      cycle: value.cycle ? String(value.cycle) : "",
      createdAt: value.createdAt ? new Date(value.createdAt).toISOString() : "",
      updatedAt: value.updatedAt ? new Date(value.updatedAt).toISOString() : "",
      paidAt: value.paidAt ? new Date(value.paidAt).toISOString() : "",
      closedAt: value.closedAt ? new Date(value.closedAt).toISOString() : "",
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
      { البيان: "تاريخ إنشاء التقرير", القيمة: new Date().toISOString() },
      { البيان: "عدد المشتركين", القيمة: subscribers.length },
      { البيان: "عدد الدورات", القيمة: cycles.length },
      { البيان: "عدد الدفعات", القيمة: payments.length },
      { البيان: "إجمالي الدفعات", القيمة: payments.reduce((total, payment) => total + Number(payment.amount || 0), 0) },
      { البيان: "إجمالي الفواتير", القيمة: cycles.reduce((total, cycle) => total + Number(cycle.invoiceAmount || 0), 0) },
      { البيان: "إجمالي المستحقات", القيمة: cycles.reduce((total, cycle) => total + Number(cycle.totalDue || 0), 0) },
      { البيان: "إجمالي المتبقي", القيمة: cycles.reduce((total, cycle) => total + Number(cycle.remainingBalance || 0), 0) },
    ]), "ملخص التقرير");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(subscribers.map((subscriber) => {
      const latestCycle = latestCycleBySubscriber.get(String(subscriber._id));
      return {
        ...normalize(subscriber),
        "الحساب السابق": Number(latestCycle?.previousBalance ?? 0),
        "الحساب الحالي": Number(latestCycle?.invoiceAmount ?? 0),
        "الحساب الكلي": Number(latestCycle?.totalDue ?? subscriber.balance ?? 0),
        "إجمالي المدفوع": Number(latestCycle?.paidAmount ?? 0),
        "المتبقي": Number(latestCycle?.remainingBalance ?? subscriber.balance ?? 0),
      };
    })), "المشتركين");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(cycles.map((cycle) => ({
      ...normalize(cycle),
      "اسم المشترك": subscriberById.get(String(cycle.subscriber))?.name || "",
    }))), "الدورات");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(payments.map((payment) => ({
      ...normalize(payment),
      "اسم المشترك": subscriberById.get(String(payment.subscriber))?.name || "",
      "الدورة": cycleById.get(String(payment.cycle))?.weekLabel || "",
    }))), "الدفعات");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(financeDays.flatMap((day) => (
      (day.cashOuts || []).length
        ? day.cashOuts.map((cashOut) => ({
            التاريخ: day.dateKey,
            إجمالي_المدفوع_اليومي: day.dailyPaid || 0,
            الرصيد_السابق: day.previousBalance,
            إجمالي_الفواتير: day.currentInvoiceTotal,
            إجمالي_الخارج: day.cashOut,
            مبلغ_الخارج: cashOut.amount,
            سبب_الخارج: cashOut.reason,
            تاريخ_الخارج: cashOut.createdAt ? new Date(cashOut.createdAt).toISOString() : "",
          }))
        : [{
            التاريخ: day.dateKey,
          إجمالي_المدفوع_اليومي: day.dailyPaid || 0,
            الرصيد_السابق: day.previousBalance,
            إجمالي_الفواتير: day.currentInvoiceTotal,
            إجمالي_الخارج: day.cashOut,
            مبلغ_الخارج: 0,
            سبب_الخارج: "",
            تاريخ_الخارج: "",
          }]
    ))), "الأيام المالية");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const date = new Date().toISOString().slice(0, 10);
    res
      .status(200)
      .set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .set("Content-Disposition", `attachment; filename="fatura-report-${date}.xlsx"`)
      .send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
