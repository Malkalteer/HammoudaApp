const mongoose = require("mongoose");

const SmsLogSchema = new mongoose.Schema(
  {
    subscriber: { type: mongoose.Schema.Types.ObjectId, ref: "Subscriber", default: null },
    subscriberId: { type: Number, default: null },
    phone: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ["queued", "sent", "failed"], default: "queued" },
    provider: { type: String, default: "custom" },
    response: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SmsLog", SmsLogSchema);
