const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");
const Subscriber = require("../models/Subscriber");
const Cycle = require("../models/Cycle");
const FinanceDay = require("../models/FinanceDay");
const { requireRole } = require("../middleware/auth");

const upload = multer({ storage: multer.memoryStorage() });

// أسماء الأعمدة المتوقعة في شيت "Main" من ملف Excel. يمكن أن تتغير بعض التسميات بين الملفات.
const HEADER_MAP = {
  subscriberId: ["الرقم", "رقم المشترك", "Subscriber ID"],
  name: ["اسم المشترك", "الاسم", "اسم"],
  panelNumber: ["رقم التابلو", "التابلو", "Panel Number"],
  phone: ["رقم الجوال ", "رقم الجوال", "رقم الهاتف", "Phone", "Mobile"],
  previousReading: ["التاشيرة السابقة", "القراءة السابقة", "التأشيرة السابقة", "القيمة السابقة"],
  currentReading: ["التاشيرة الحالية", "القراءة الحالية", "التأشيرة الحالية", "القيمة الحالية"],
  previousBalance: ["حساب سابق", "الحساب السابق", "الرصيد السابق"],
  currentInvoice: ["فاتورة حالية", "الفاتورة الحالية", "حساب حالي", "الحساب الحالي"],
  consumption: ["الاستهلاك", "الإستهلاك", "الاستهلاك", "الاستهلاك الحالي", "الكمية"],
  total: ["التكلفة", "الحساب الكلي", "التكلفة الكلية", "المجموع", "المجموع الكلي", "Total"],
};

const normalizeHeader = (value) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");

const findColumnIndex = (headerRow, aliases) => {
  if (!Array.isArray(headerRow)) return -1;

  const match = aliases
    .map((alias) => normalizeHeader(alias))
    .find((alias) => headerRow.some((cell) => normalizeHeader(cell) === alias || normalizeHeader(cell).includes(alias)));

  if (match) {
    return headerRow.findIndex((cell) => {
      const text = normalizeHeader(cell);
      return text === match || text.includes(match);
    });
  }

  return -1;
};

// === استيراد ملف Excel القديم مرة واحدة عند بدء تشغيل النظام الجديد ===
router.post("/excel", requireRole("admin"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "لم يتم إرفاق أي ملف" });

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets["Main (2)"] || workbook.Sheets["Main"] || workbook.Sheets[Object.keys(workbook.Sheets)[0]];
    if (!sheet) return res.status(400).json({ error: "لم يتم العثور على شيت Excel صالح" });

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    let headerRowIndex = rows.findIndex((row) => Array.isArray(row) && row.some((cell) => normalizeHeader(cell).includes("الرقم")));
    if (headerRowIndex === -1) headerRowIndex = 0;

    const headerRow = rows[headerRowIndex] || [];

    const idCol = findColumnIndex(headerRow, HEADER_MAP.subscriberId);
    const nameCol = findColumnIndex(headerRow, HEADER_MAP.name);
    const panelCol = findColumnIndex(headerRow, HEADER_MAP.panelNumber);
    const phoneCol = findColumnIndex(headerRow, HEADER_MAP.phone);
    const prevCol = findColumnIndex(headerRow, HEADER_MAP.previousReading);
    const currentCol = findColumnIndex(headerRow, HEADER_MAP.currentReading);
    const previousBalanceCol = findColumnIndex(headerRow, HEADER_MAP.previousBalance);
    const currentInvoiceCol = findColumnIndex(headerRow, HEADER_MAP.currentInvoice);
    const consumptionCol = findColumnIndex(headerRow, HEADER_MAP.consumption);
    const totalCol = findColumnIndex(headerRow, HEADER_MAP.total);

    const dataRows = rows.slice(headerRowIndex + 1).filter((r) => Array.isArray(r) && r[idCol] != null && r[idCol] !== "");

    let imported = 0;
    let skipped = 0;
    let importedPreviousBalanceTotal = 0;
    let importedCurrentInvoiceTotal = 0;

    for (const r of dataRows) {
      const subscriberId = Number(r[idCol]);
      if (!subscriberId) {
        skipped++;
        continue;
      }

      const previousValue = Number(r[prevCol]);
      const currentValue = Number(r[currentCol]);
      const consumptionValue = Number(r[consumptionCol]);
      const balanceValue = Number(r[totalCol]);
      const previousBalanceValue = Number(r[previousBalanceCol]);
      const currentInvoiceValue = Number(r[currentInvoiceCol]);
      const previousReading = Number.isFinite(previousValue) ? previousValue : 0;
      const currentReading = Number.isFinite(currentValue) ? currentValue : previousReading;
      const consumption = Number.isFinite(consumptionValue)
        ? consumptionValue
        : Math.max(0, currentReading - previousReading);
      const previousBalance = Number.isFinite(previousBalanceValue) ? previousBalanceValue : 0;
      const invoiceAmount = Number.isFinite(currentInvoiceValue)
        ? currentInvoiceValue
        : (Number.isFinite(balanceValue) ? balanceValue : 0);
      const totalDue = previousBalance + invoiceAmount;
      let subscriber = await Subscriber.findOne({ subscriberId });
      if (subscriber) {
        subscriber.name = r[nameCol] || subscriber.name;
        subscriber.panelNumber = r[panelCol] ? String(r[panelCol]) : subscriber.panelNumber;
        subscriber.phone = r[phoneCol] != null ? String(r[phoneCol]) : subscriber.phone;
        subscriber.previousReading = previousReading;
        subscriber.currentReading = currentReading;
        subscriber.consumption = consumption;
        subscriber.lastReading = currentReading;
        subscriber.balance = totalDue;
        subscriber.unitPrice = 1;
        await subscriber.save();
      } else {
        subscriber = await Subscriber.create({
          subscriberId,
          name: r[nameCol] || `مشترك ${subscriberId}`,
          panelNumber: r[panelCol] ? String(r[panelCol]) : "",
          phone: r[phoneCol] != null ? String(r[phoneCol]) : "",
          previousReading,
          currentReading,
          consumption,
          lastReading: currentReading,
          balance: totalDue,
          unitPrice: 1,
        });
      }

      const cycle = await Cycle.findOne({ subscriber: subscriber._id }).sort({ createdAt: -1 });
      if (cycle) {
        cycle.previousReading = previousReading;
        cycle.currentReading = currentReading;
        cycle.consumption = consumption;
        cycle.previousBalance = previousBalance;
        cycle.invoiceAmount = invoiceAmount;
        cycle.totalDue = totalDue;
        cycle.remainingBalance = Math.max(0, totalDue - Number(cycle.paidAmount || 0));
        cycle.status = cycle.remainingBalance <= 0 ? "paid" : cycle.paidAmount > 0 ? "partial" : "unpaid";
        await cycle.save();
      } else {
        await Cycle.create({
          subscriber: subscriber._id,
          subscriberId: subscriber.subscriberId,
          previousReading,
          currentReading,
          consumption,
          previousBalance,
          unitPrice: 1,
          invoiceAmount,
          totalDue,
          remainingBalance: totalDue,
          status: totalDue > 0 ? "unpaid" : "paid",
          weekLabel: new Date().toISOString().slice(0, 10),
        });
      }

      importedPreviousBalanceTotal += previousBalance;
      importedCurrentInvoiceTotal += invoiceAmount;
      imported++;
    }

    const dateKey = new Date().toISOString().slice(0, 10);
    await FinanceDay.findOneAndUpdate(
      { dateKey },
      { $set: {
        hasStocktake: true,
        previousBalance: importedPreviousBalanceTotal,
        currentInvoiceTotal: importedCurrentInvoiceTotal,
      } },
      { upsert: true }
    );

    res.json({
      message: "تم الاستيراد",
      imported,
      skipped,
      previousBalance: importedPreviousBalanceTotal,
      currentInvoiceTotal: importedCurrentInvoiceTotal,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
