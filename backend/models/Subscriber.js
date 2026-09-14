const mongoose = require("mongoose");

const SubscriberSchema = new mongoose.Schema(
  {
    subscriberId: { type: Number, required: true, unique: true }, // عمود "الرقم"
    name: { type: String, required: true }, // اسم المشترك
    panelNumber: { type: String }, // رقم التابلو
    phone: { type: String, default: "" }, // رقم الهاتف لإرسال التنبيهات SMS
    previousReading: { type: Number, default: 0 }, // التأشيرة السابقة
    currentReading: { type: Number, default: 0 }, // التأشيرة الحالية
    consumption: { type: Number, default: 0 }, // الاستهلاك
    lastReading: { type: Number, default: 0 }, // آخر تأشيرة مسجّلة
    balance: { type: Number, default: 0 }, // الرصيد المتبقي غير المسدد
    unitPrice: { type: Number, default: 1 }, // سعر الوحدة
    customUnitPrice: { type: Number, default: null }, // سعر خاص اختياري لهذا المشترك
    connectionStatus: {
      type: String,
      enum: ["متصل", "مطلوب قطعه", "مقطوع", "بانتظار الوصل"],
      default: "متصل",
    },
    active: { type: Boolean, default: true },
    smsEnabled: { type: Boolean, default: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscriber", SubscriberSchema);
