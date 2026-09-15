const express = require("express");
const router = express.Router();
const Subscriber = require("../models/Subscriber");
const Cycle = require("../models/Cycle");
const FinanceDay = require("../models/FinanceDay");
const StocktakeRequest = require("../models/StocktakeRequest");
const Payment = require("../models/Payment");
const User = require("../models/User");
const XLSX = require("xlsx");
const multer = require("multer");
const { authMiddleware, requireRole } = require("../middleware/auth");
const Setting = require("../models/Setting");
const { sendSms } = require("../services/sms");

const upload = multer({ storage: multer.memoryStorage() });

const getCurrentKwhPrice = async () => {
  const setting = await Setting.findOne({ key: "kwhPrice" });
  return Number(setting?.value ?? 1);
};

const getPanelNumberValue = (subscriber) => {
  const value = Number.parseInt(subscriber.panelNumber, 10);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
};

const normalizeStocktakeValue = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

// جلب المشتركين مع بحث وتقسيم صفحات (مع بحث اختياري ?q=)
router.get("/", requireRole("admin", "accountant", "electrician"), async (req, res) => {
  const { q, status } = req.query;
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize, 10) || 25, 10), 100);
  const filter = {};

  if (q) {
    filter.$or = [
      { name: new RegExp(q, "i") },
      { panelNumber: new RegExp(q, "i") },
      { phone: new RegExp(q, "i") },
      { subscriberId: Number(q) || -1 },
    ];
  }

  if (status === "overdue") {
    filter.balance = { $gt: 0 };
  }

  if (status === "connected") {
    filter.connectionStatus = "متصل";
  }

  if (status === "disconnected") {
    filter.connectionStatus = { $in: ["مطلوب قطعه", "مقطوع", "بانتظار الوصل"] };
  }

  const [total, subscribers] = await Promise.all([
    Subscriber.countDocuments(filter),
    Subscriber.aggregate([
      { $match: filter },
      {
        $addFields: {
          _panelNumberSort: {
            $convert: { input: "$panelNumber", to: "int", onError: Number.MAX_SAFE_INTEGER, onNull: Number.MAX_SAFE_INTEGER },
          },
        },
      },
      { $sort: { _panelNumberSort: 1, subscriberId: 1 } },
      { $skip: (page - 1) * pageSize },
      { $limit: pageSize },
    ]),
  ]);

  const subscriberObjectIds = subscribers.map((s) => s._id);
  const [latestCycles, latestPayments] = subscriberObjectIds.length
    ? await Promise.all([
        Cycle.aggregate([
          { $match: { subscriber: { $in: subscriberObjectIds } } },
          { $sort: { createdAt: -1 } },
          { $group: { _id: "$subscriber", cycle: { $first: "$$ROOT" } } },
        ]),
        Payment.aggregate([
          { $match: { subscriber: { $in: subscriberObjectIds } } },
          { $sort: { paidAt: -1, createdAt: -1 } },
          { $group: { _id: "$subscriber", payment: { $first: "$$ROOT" } } },
        ]),
      ])
    : [[], []];

  const latestCycleBySubscriber = new Map(
    latestCycles.map((item) => [String(item._id), item.cycle])
  );
  const latestPaymentBySubscriber = new Map(
    latestPayments.map((item) => [String(item._id), item.payment])
  );
  const payerIds = latestPayments
    .map((item) => item.payment?.paidBy)
    .filter(Boolean);
  const payers = payerIds.length
    ? await User.find({ _id: { $in: payerIds } }).select("name username").lean()
    : [];
  const payerById = new Map(payers.map((payer) => [String(payer._id), payer]));

  const response = subscribers.map((s) => {
    const cycle = latestCycleBySubscriber.get(String(s._id));
    const latestPayment = latestPaymentBySubscriber.get(String(s._id));
    const payer = latestPayment?.paidBy ? payerById.get(String(latestPayment.paidBy)) : null;
    const previousReading = cycle ? Number(cycle.previousReading || 0) : Number(s.previousReading || 0);
    const currentReading = cycle ? Number(cycle.currentReading || 0) : Number(s.currentReading || 0);
    const consumption = cycle ? Number(cycle.consumption || 0) : Number(s.consumption || 0);
    const previousBalance = cycle ? Number(cycle.previousBalance || 0) : Number(s.balance || 0);
    const currentInvoice = cycle ? Number(cycle.invoiceAmount || 0) : 0;
    const totalAccount = cycle ? Number(cycle.totalDue || 0) : Number(s.balance || 0);

    return {
      ...s.toObject(),
      previousReading,
      currentReading,
      consumption,
      previousBalance,
      currentInvoice,
      totalAccount,
      paidAmount: cycle ? Number(cycle.paidAmount || 0) : 0,
      remainingBalance: cycle ? Number(cycle.remainingBalance ?? cycle.totalDue ?? 0) : Number(s.balance || 0),
      paymentStatus: cycle?.status || "unpaid",
      lastCycleId: cycle ? cycle._id : null,
      lastPaymentBy: latestPayment?.paidByName || payer?.name || latestPayment?.paidByUsername || payer?.username || "-",
    };
  });

  res.json({
    items: response,
    page,
    pageSize,
    total,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
  });
});

// إضافة مشترك جديد يدويًا
router.post("/", requireRole("admin", "accountant"), async (req, res) => {
  try {
    const payload = { ...req.body };

    const lastSubscriber = await Subscriber.findOne({}).sort({ subscriberId: -1 }).limit(1);
    payload.subscriberId = (lastSubscriber?.subscriberId ?? 0) + 1;

    if (!payload.panelNumber) {
      const subscribersWithPanels = await Subscriber.find({ panelNumber: { $exists: true, $ne: "" } })
        .select("panelNumber");
      const lastPanelNumber = subscribersWithPanels.reduce((max, current) => {
        const value = Number.parseInt(current.panelNumber, 10);
        return Number.isFinite(value) && value > max ? value : max;
      }, 0);
      payload.panelNumber = String(lastPanelNumber + 1);
    }

    if (payload.currentReading != null && payload.currentReading !== "") {
      const readingValue = Number(payload.currentReading);
      payload.lastReading = readingValue;
      payload.currentReading = readingValue;
      payload.previousReading = 0;
      payload.consumption = 0;
    }

    const subscriber = await Subscriber.create(payload);
    res.status(201).json(subscriber);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// تعديل بيانات مشترك
router.put("/:id", requireRole("admin", "accountant"), async (req, res) => {
  const subscriber = await Subscriber.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(subscriber);
});

// حذف مشترك (مثلاً عند ترحيله من المنطقة)
router.delete("/:id", requireRole("admin", "accountant"), async (req, res) => {
  await Subscriber.findByIdAndDelete(req.params.id);
  // ملاحظة: لا نحذف سجلات الدورات/الفواتير القديمة الخاصة به، تبقى محفوظة للأرشيف
  res.json({ message: "تم حذف المشترك" });
});

// === جدول القطع: جلب المشتركين الذين يجب قطعهم ===
router.get("/status/required-disconnect", requireRole("admin", "accountant", "electrician"), async (req, res) => {
  const list = await Subscriber.find({ connectionStatus: "مطلوب قطعه" }).sort({ subscriberId: 1 });
  res.json(list);
});

// === جدول المقطوعين: جلب المشتركين الذين تم قطعهم فعليًا ===
router.get("/status/cut", requireRole("admin", "accountant", "electrician"), async (req, res) => {
  const list = await Subscriber.find({ connectionStatus: "مقطوع" }).sort({ subscriberId: 1 });
  res.json(list);
});

// === مسار قديم للتوافق: جلب سجلات القطع الحالية ===
router.get("/status/disconnected", requireRole("admin", "accountant", "electrician"), async (req, res) => {
  const list = await Subscriber.find({ connectionStatus: { $in: ["مطلوب قطعه", "مقطوع"] } }).sort({ subscriberId: 1 });
  res.json(list);
});

// === إرسال مجموعة مشتركين مختارين إلى "صفحة القطع" ===
router.post("/mark-disconnect", requireRole("admin", "accountant"), async (req, res) => {
  const { ids } = req.body;
  await Subscriber.updateMany({ _id: { $in: ids } }, { connectionStatus: "مطلوب قطعه" });
  res.json({ message: "تم إرسالهم إلى صفحة القطع" });
});

// === تأكيد تنفيذ القطع ونقل المشترك إلى جدول المقطوعين ===
router.put("/:id/confirm-disconnect", requireRole("admin", "electrician"), async (req, res) => {
  const subscriber = await Subscriber.findOneAndUpdate(
    { _id: req.params.id, connectionStatus: "مطلوب قطعه" },
    { connectionStatus: "مقطوع" },
    { new: true }
  );
  if (!subscriber) return res.status(404).json({ error: "المشترك غير موجود في جدول القطع" });
  res.json(subscriber);
});

// === نقل المشترك المقطوع إلى جدول الوصل ===
router.put("/:id/send-to-reconnect", requireRole("admin", "electrician"), async (req, res) => {
  const subscriber = await Subscriber.findOneAndUpdate(
    { _id: req.params.id, connectionStatus: "مقطوع" },
    { connectionStatus: "بانتظار الوصل" },
    { new: true }
  );
  if (!subscriber) return res.status(404).json({ error: "المشترك غير موجود في جدول المقطوعين" });
  res.json(subscriber);
});

// === جدول الوصل: جلب المشتركين الذين تم قطعهم وينتظرون إعادة الوصل ===
router.get("/status/pending-reconnect", requireRole("admin", "accountant", "electrician"), async (req, res) => {
  const list = await Subscriber.find({ connectionStatus: "بانتظار الوصل" }).sort({ subscriberId: 1 });
  res.json(list);
});

// جلب مشترك واحد + آخر دورة له
router.get("/:id", requireRole("admin", "accountant"), async (req, res) => {
  const subscriber = await Subscriber.findById(req.params.id);
  if (!subscriber) return res.status(404).json({ error: "المشترك غير موجود" });
  const lastCycle = await Cycle.findOne({ subscriber: subscriber._id }).sort({ createdAt: -1 });
  res.json({ subscriber, lastCycle });
});

router.post("/send-reminder", requireRole("admin", "accountant"), async (req, res) => {
  try {
    const { ids, message } = req.body;
    const subscribers = await Subscriber.find({ _id: { $in: ids } });

    const results = [];
    for (const s of subscribers) {
      const text = message || `مرحباً ${s.name}، يوجد رصيد مستحق بقيمة ${s.balance} على حسابك. الرجاء السداد في أقرب وقت.`;
      const result = await sendSms({
        phone: s.phone,
        message: text,
        subscriberId: s.subscriberId,
        subscriber: s._id,
      });
      results.push({ subscriberId: s.subscriberId, name: s.name, ...result });
    }

    res.json({ message: "تم إرسال الرسائل", results });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// === إعادة التوصيل وإخفاء المشترك من جدول الوصل ===
router.put("/:id/reconnect", requireRole("admin", "electrician"), async (req, res) => {
  const subscriber = await Subscriber.findByIdAndUpdate(
    req.params.id,
    { connectionStatus: "متصل" },
    { new: true }
  );
  res.json(subscriber);
});

const validateStocktakeItems = async (items) => {
  if (!Array.isArray(items) || items.length === 0) return "يرجى إدخال التاشيرات الجديدة أولاً";

  const subscribers = await Subscriber.find({ active: true }).select("_id name lastReading currentReading");
  const submittedIds = new Set(items.map((item) => String(item.subscriberId)));
  const missing = subscribers.find((subscriber) => !submittedIds.has(String(subscriber._id)));
  if (missing) return `لا يمكن الترحيل: التاشيرة ناقصة للمشترك ${missing.name}`;
  if (submittedIds.size !== items.length || items.length !== subscribers.length) {
    return "لا يمكن الترحيل: توجد تاشيرات مكررة أو مشترك غير موجود";
  }

  for (const item of items) {
    const subscriber = subscribers.find((entry) => String(entry._id) === String(item.subscriberId));
    const reading = Number(item.currentReading);
    const previous = Number(subscriber.lastReading ?? subscriber.currentReading ?? 0);
    if (!Number.isFinite(reading) || reading < previous) {
      return `التاشيرة الجديدة غير صالحة للمشترك ${subscriber.name}`;
    }
  }
  return null;
};

// === إرسال طلب جرد كامل إلى صفحة الإدارة ===
router.post("/stocktake/request", requireRole("admin", "electrician"), async (req, res) => {
  try {
    const validationError = await validateStocktakeItems(req.body.items);
    if (validationError) return res.status(400).json({ error: validationError });

    const pending = await StocktakeRequest.findOne({ status: "pending" });
    if (pending) return res.status(409).json({ error: "يوجد طلب جرد بانتظار موافقة الإدارة" });

    const request = await StocktakeRequest.create({ items: req.body.items, requestedBy: req.user.id });
    res.status(201).json({ message: "تم إرسال طلب الجرد إلى الإدارة للموافقة", requestId: request._id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/stocktake/template", requireRole("admin", "electrician"), async (req, res) => {
  try {
    const subscribers = await Subscriber.find({ active: true })
      .select("name panelNumber")
      .sort({ name: 1 })
      .lean();
    const rows = subscribers.map((subscriber) => ({
      الاسم: subscriber.name,
      "رقم التابلو": subscriber.panelNumber || "",
      "التأشيرة الجديدة": "",
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "الجرد");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    res
      .status(200)
      .set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .set("Content-Disposition", `attachment; filename="fatura-stocktake-template-${new Date().toISOString().slice(0, 10)}.xlsx"`)
      .send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/stocktake/import", requireRole("admin", "electrician"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "لم يتم إرفاق ملف Excel" });

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return res.status(400).json({ error: "لم يتم العثور على ورقة صالحة في الملف" });

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const subscribers = await Subscriber.find({ active: true }).select("_id name panelNumber currentReading lastReading").lean();
    const subscribersByKey = new Map(
      subscribers.map((subscriber) => [
        `${normalizeStocktakeValue(subscriber.name)}|${normalizeStocktakeValue(subscriber.panelNumber)}`,
        subscriber,
      ])
    );
    const readings = {};
    const unmatched = [];
    const invalid = [];
    const matchedIds = new Set();

    rows.forEach((row, index) => {
      const name = row["الاسم"] ?? row.name ?? row.Name ?? "";
      const panelNumber = row["رقم التابلو"] ?? row["التابلو"] ?? row.panelNumber ?? row["Panel Number"] ?? "";
      const newReading = row["التأشيرة الجديدة"] ?? row["التاشيرة الجديدة"] ?? row.newReading ?? row["New Reading"] ?? "";
      if (name === "" && panelNumber === "" && newReading === "") return;

      const key = `${normalizeStocktakeValue(name)}|${normalizeStocktakeValue(panelNumber)}`;
      const subscriber = subscribersByKey.get(key);
      if (!subscriber) {
        unmatched.push({ row: index + 2, name, panelNumber });
        return;
      }

      const value = Number(newReading);
      const currentReading = Number(subscriber.currentReading ?? subscriber.lastReading ?? 0);
      if (!Number.isFinite(value) || value < currentReading) {
        invalid.push({ row: index + 2, name: subscriber.name, currentReading });
        return;
      }
      readings[String(subscriber._id)] = value;
      matchedIds.add(String(subscriber._id));
    });

    const missing = subscribers
      .filter((subscriber) => !matchedIds.has(String(subscriber._id)))
      .map((subscriber) => ({ name: subscriber.name, panelNumber: subscriber.panelNumber || "" }));

    res.json({
      readings,
      matchedCount: matchedIds.size,
      unmatched,
      invalid,
      missing,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/stocktake/requests", authMiddleware, requireRole("admin", "electrician"), async (req, res) => {
  const requests = await StocktakeRequest.find({ status: "pending" }).sort({ createdAt: 1 }).populate("requestedBy", "name username");
  res.json(requests);
});

// === موافقة الإدارة وتنفيذ جرد جماعي كامل ===
router.post("/stocktake/requests/:id/approve", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const stocktakeRequest = await StocktakeRequest.findOne({ _id: req.params.id, status: "pending" });
    if (!stocktakeRequest) return res.status(404).json({ error: "طلب الجرد غير موجود أو تمت معالجته" });

    const validationError = await validateStocktakeItems(stocktakeRequest.items);
    if (validationError) return res.status(400).json({ error: validationError });

    const { items } = stocktakeRequest;

    const kwhPrice = await getCurrentKwhPrice();

    // إنشاء لقطة كاملة قبل إنشاء دورات الجرد الجديدة أو تغيير الأرصدة.
    const [subscribersSnapshot, cyclesSnapshot, paymentsSnapshot, financeDaysSnapshot] = await Promise.all([
      Subscriber.find().sort({ subscriberId: 1 }).lean(),
      Cycle.find().sort({ createdAt: 1 }).lean(),
      Payment.find().sort({ paidAt: 1 }).lean(),
      FinanceDay.find().sort({ dateKey: 1 }).lean(),
    ]);

    const subscribersByObjectId = new Map(
      subscribersSnapshot.map((subscriber) => [String(subscriber._id), subscriber])
    );
    const subscribersBySubscriberId = new Map(
      subscribersSnapshot.map((subscriber) => [String(subscriber.subscriberId), subscriber])
    );
    const cyclesByObjectId = new Map(
      cyclesSnapshot.map((cycle) => [String(cycle._id), cycle])
    );
    const latestCycleBySubscriberId = new Map();
    cyclesSnapshot.forEach((cycle) => {
      latestCycleBySubscriberId.set(String(cycle.subscriber), cycle);
    });
    const toRow = (value) => ({
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
    const summaryRows = [
      { البيان: "تاريخ استخراج النسخة", القيمة: new Date().toISOString() },
      { البيان: "سبب الاستخراج", القيمة: "قبل اعتماد الجرد وإنشاء الحساب المالي الجديد" },
      { البيان: "عدد المشتركين", القيمة: subscribersSnapshot.length },
      { البيان: "عدد الدورات السابقة", القيمة: cyclesSnapshot.length },
      { البيان: "عدد الدفعات السابقة", القيمة: paymentsSnapshot.length },
      { البيان: "إجمالي الدفعات", القيمة: paymentsSnapshot.reduce((total, payment) => total + Number(payment.amount || 0), 0) },
      { البيان: "إجمالي المدفوع اليومي المرحّل", القيمة: financeDaysSnapshot.reduce((total, day) => total + Number(day.dailyPaid || 0), 0) },
      { البيان: "عدد الأيام المالية", القيمة: financeDaysSnapshot.length },
      { البيان: "إجمالي الفواتير السابقة", القيمة: cyclesSnapshot.reduce((total, cycle) => total + Number(cycle.invoiceAmount || 0), 0) },
      { البيان: "إجمالي المستحقات السابقة", القيمة: cyclesSnapshot.reduce((total, cycle) => total + Number(cycle.totalDue || 0), 0) },
      { البيان: "إجمالي المتبقي السابق", القيمة: cyclesSnapshot.reduce((total, cycle) => total + Number(cycle.remainingBalance || 0), 0) },
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "ملخص التصدير");
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(subscribersSnapshot.map((subscriber) => {
        const latestCycle = latestCycleBySubscriberId.get(String(subscriber._id));
        return {
          ...toRow(subscriber),
          "الحساب السابق": Number(latestCycle?.previousBalance ?? 0),
          "الحساب الحالي": Number(latestCycle?.invoiceAmount ?? 0),
          "الحساب الكلي": Number(latestCycle?.totalDue ?? subscriber.balance ?? 0),
          "إجمالي المدفوع": Number(latestCycle?.paidAmount ?? 0),
          "المتبقي": Number(latestCycle?.remainingBalance ?? subscriber.balance ?? 0),
        };
      })),
      "المشتركين"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(cyclesSnapshot.map((cycle) => ({
        ...toRow(cycle),
        "اسم المشترك": subscribersByObjectId.get(String(cycle.subscriber))?.name || "",
      }))),
      "الدورات السابقة"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(paymentsSnapshot.map((payment) => ({
        ...toRow(payment),
        "اسم المشترك": subscribersByObjectId.get(String(payment.subscriber))?.name || "",
        "دورة": cyclesByObjectId.get(String(payment.cycle))?.weekLabel || "",
      }))),
      "الدفعات"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(financeDaysSnapshot.flatMap((day) =>
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
              مغلق_في: day.closedAt ? new Date(day.closedAt).toISOString() : "",
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
              مغلق_في: day.closedAt ? new Date(day.closedAt).toISOString() : "",
            }]
      )),
      "الأيام المالية"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(items.map((item) => ({
        المشترك: String(item.subscriberId),
        التأشيرة_الجديدة: item.currentReading,
        اسم_المشترك: subscribersBySubscriberId.get(String(item.subscriberId))?.name || "",
      }))),
      "طلب الجرد"
    );
    const archiveBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const createdCycles = [];
    let currentInvoiceTotal = 0;

    for (const item of items) {
      const subscriber = await Subscriber.findById(item.subscriberId);
      if (!subscriber) continue;

      const newCurrentReading = Number(item.currentReading);
      if (!Number.isFinite(newCurrentReading)) continue;

      const currentReadingInDb = Number(subscriber.lastReading ?? subscriber.currentReading ?? 0);
      if (newCurrentReading < currentReadingInDb) {
        return res.status(400).json({
          error: `لا يمكن إدخال قراءة جديدة أقل من القراءة الحالية للمشترك ${subscriber.name}`,
        });
      }

      const previousReading = currentReadingInDb;
      const consumption = Math.max(0, newCurrentReading - previousReading);
      const unitPrice = subscriber.customUnitPrice ?? kwhPrice;
      const invoiceAmount = consumption * unitPrice;
      const previousBalance = Number(subscriber.balance || 0);
      const totalDue = previousBalance + invoiceAmount;

      const cycle = await Cycle.create({
        subscriber: subscriber._id,
        subscriberId: subscriber.subscriberId,
        previousReading,
        currentReading: newCurrentReading,
        consumption,
        previousBalance,
        unitPrice,
        invoiceAmount,
        totalDue,
        remainingBalance: totalDue,
        status: "unpaid",
        weekLabel: new Date().toISOString().slice(0, 10),
      });

      createdCycles.push(cycle);
      currentInvoiceTotal += invoiceAmount;

      subscriber.previousReading = previousReading;
      subscriber.currentReading = newCurrentReading;
      subscriber.lastReading = newCurrentReading;
      subscriber.consumption = consumption;
      subscriber.unitPrice = unitPrice;
      subscriber.balance = totalDue;
      await subscriber.save();
    }

    const dateKey = new Date().toISOString().slice(0, 10);
    const financeDay = await FinanceDay.findOne({ dateKey });
    const currentFridayTotal = Number(financeDay?.currentInvoiceTotal || 0);
    const previousFridayBalance = Number(financeDay?.previousBalance || 0);
    const totalDailyPaid = financeDaysSnapshot.reduce(
      (total, day) => total + Number(day.dailyPaid || 0),
      0
    );
    const cashOut = Number(financeDay?.cashOut || 0);
    await FinanceDay.findOneAndUpdate(
      { dateKey },
      {
        $set: {
          previousBalance: previousFridayBalance + currentFridayTotal - totalDailyPaid ,
          currentInvoiceTotal,
          dailyPaid: 0,
          cashOut: 0,
          cashOuts: [],
        },
      },
      { upsert: true }
    );
    await FinanceDay.updateMany(
      { dateKey: { $ne: dateKey }, dailyPaid: { $ne: 0 } },
      { $set: { dailyPaid: 0 } }
    );

    stocktakeRequest.status = "approved";
    stocktakeRequest.approvedBy = req.user.id;
    stocktakeRequest.approvedAt = new Date();
    await stocktakeRequest.save();

    const archiveDate = new Date().toISOString().slice(0, 10);
    res
      .status(201)
      .set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .set("Content-Disposition", `attachment; filename="fatura-before-stocktake-${archiveDate}.xlsx"`)
      .send(archiveBuffer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
