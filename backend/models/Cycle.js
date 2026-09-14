const mongoose = require("mongoose");

// كل مستند = دورة أسبوعية واحدة لمشترك واحد (تأشيرة + فاتورة + دفعة)
const CycleSchema = new mongoose.Schema(
  {
    subscriber: { type: mongoose.Schema.Types.ObjectId, ref: "Subscriber", required: true },
    subscriberId: { type: Number, required: true }, // نسخة مباشرة للطباعة السريعة بدون populate

    previousReading: { type: Number, required: true },
    currentReading: { type: Number, required: true },
    consumption: { type: Number, required: true }, // currentReading - previousReading

    previousBalance: { type: Number, default: 0 }, // الرصيد المرحّل من الأسبوع السابق
    unitPrice: { type: Number, default: 1 }, // سعر الكيلو واط المستخدم في هذه الدورة
    invoiceAmount: { type: Number, required: true }, // consumption * unitPrice
    totalDue: { type: Number, required: true }, // previousBalance + invoiceAmount

    paidAmount: { type: Number, default: 0 },
    remainingBalance: { type: Number, default: 0 }, // totalDue - paidAmount (يُرحَّل للأسبوع القادم)

    paymentDate: { type: Date },
    status: { type: String, enum: ["unpaid", "partial", "paid"], default: "unpaid" },

    weekLabel: { type: String }, // مثال: "2026-W35" لعرض الدورة بسهولة
  },
  { timestamps: true }
);

module.exports = mongoose.model("Cycle", CycleSchema);
