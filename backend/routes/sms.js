const SmsLog = require("../models/SmsLog");
const Setting = require("../models/Setting");

// عنوان API الثابت لخدمة SMS Gateway for Android (وضع Cloud Server)
// راجع: https://docs.sms-gate.app/integration/api/
const SMS_GATE_API_URL = "https://api.sms-gate.app/3rdparty/v1/messages";

const getGatewaySettings = async () => {
  const settings = await Setting.find({
    key: { $in: ["smsGatewayUsername", "smsGatewayPassword"] },
  }).lean();
  const values = Object.fromEntries(settings.map((setting) => [setting.key, String(setting.value || "")]));
  return { username: values.smsGatewayUsername, password: values.smsGatewayPassword };
};

async function sendSms({ phone, message, subscriberId = null, subscriber = null, provider = "custom" }) {
  const cleanPhone = String(phone || "").trim();

  if (!cleanPhone) {
    const log = await SmsLog.create({
      subscriber,
      subscriberId,
      phone: "",
      message,
      status: "failed",
      provider,
      response: "رقم الهاتف غير موجود",
    });
    return { ok: false, log, error: "رقم الهاتف غير موجود" };
  }

  try {
    const gateway = await getGatewaySettings();
    if (!gateway.username || !gateway.password) {
      throw new Error("إعدادات بوابة SMS غير مكتملة: يرجى إدخال اسم المستخدم وكلمة المرور من صفحة الإعدادات");
    }

    const basicAuth = Buffer.from(`${gateway.username}:${gateway.password}`).toString("base64");

    const response = await fetch(SMS_GATE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
      },
      body: JSON.stringify({
        message,
        phoneNumbers: [cleanPhone],
      }),
      signal: AbortSignal.timeout(15000),
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`بوابة SMS أعادت الحالة ${response.status}${responseText ? `: ${responseText.slice(0, 300)}` : ""}`);
    }

    const log = await SmsLog.create({
      subscriber,
      subscriberId,
      phone: cleanPhone,
      message,
      status: "sent",
      provider: "sms-gate.app",
      response: responseText || "تم الإرسال عبر SMS Gateway for Android",
    });
    return { ok: true, provider: "sms-gate.app", log };
  } catch (error) {
    const log = await SmsLog.create({
      subscriber,
      subscriberId,
      phone: cleanPhone,
      message,
      status: "failed",
      provider,
      response: error.message,
    });

    return { ok: false, provider, log, error: error.message };
  }
}

module.exports = { sendSms };