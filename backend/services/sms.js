const SmsLog = require("../models/SmsLog");
const Setting = require("../models/Setting");

const getGatewaySettings = async () => {
  const settings = await Setting.find({ key: { $in: ["smsGatewayUrl", "smsGatewayToken"] } }).lean();
  const values = Object.fromEntries(settings.map((setting) => [setting.key, String(setting.value || "")]));
  return { url: values.smsGatewayUrl, token: values.smsGatewayToken };
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

  const smsProvider = process.env.SMS_PROVIDER || "mock";


  try {
    const gateway = await getGatewaySettings();
    if (gateway.url && gateway.token) {
      const response = await fetch(gateway.url, {
        method: "POST",
        headers: {
          Authorization: gateway.token,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ to: cleanPhone, message }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`بوابة SMS أعادت الحالة ${response.status}`);

      const log = await SmsLog.create({
        subscriber,
        subscriberId,
        phone: cleanPhone,
        message,
        status: "sent",
        provider: "traccar",
        response: "تم الإرسال عبر بوابة الهاتف",
      });
      return { ok: true, provider: "traccar", log };
    }

    if (smsProvider === "mock") {
      const log = await SmsLog.create({
        subscriber,
        subscriberId,
        phone: cleanPhone,
        message,
        status: "sent",
        provider: "mock",
        response: "تم محاكاة إرسال الرسالة بنجاح (SMS mock)",
      });

      return { ok: true, provider: "mock", log, simulated: true };
    }

    if (smsProvider === "twilio") {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromPhone = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !fromPhone) {
        throw new Error("لم يتم تكوين بيانات Twilio في المتغيرات البيئية");
      }

      const twilio = require("twilio");
      const client = twilio(accountSid, authToken);
      const result = await client.messages.create({
        body: message,
        from: fromPhone,
        to: cleanPhone,
      });

      const log = await SmsLog.create({
        subscriber,
        subscriberId,
        phone: cleanPhone,
        message,
        status: "sent",
        provider: "twilio",
        response: JSON.stringify(result.sid),
      });

      return { ok: true, provider: "twilio", result, log };
    }

    throw new Error(`مزود SMS غير مدعوم: ${smsProvider}`);
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
