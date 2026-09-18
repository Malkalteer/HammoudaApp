import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Settings() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getSmsGateway()
      .then((settings) => setForm(settings))
      .catch((error) => setMsg(error.message))
      .finally(() => setLoading(false));
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      await api.setSmsGateway(form);
      setMsg("تم حفظ إعدادات بوابة SMS بنجاح");
    } catch (error) {
      setMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="container">جارِ التحميل...</div>;

  return (
    <div className="container">
      <div className="card">
        <h2>إعدادات النظام</h2>
        <h3>بوابة رسائل SMS (SMS Gateway for Android — Cloud Server)</h3>
        <p>
          تُستخدم هذه البيانات لإرسال تفاصيل الدفع تلقائيًا بعد نجاح الدفع، عبر خدمة{" "}
          <strong>SMS Gateway for Android</strong> بوضع Cloud Server. احصل على اسم المستخدم وكلمة
          المرور من قسم "Cloud Server" داخل التطبيق على جوالك.
        </p>
        <form onSubmit={save} className="auth-form">
          <label>
            اسم المستخدم (Username)
            <input
              type="text"
              required
              autoComplete="off"
              placeholder="أدخل اسم المستخدم من التطبيق"
              value={form.username}
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
            />
          </label>
          <label>
            كلمة المرور (Password)
            <input
              type="password"
              required
              autoComplete="off"
              placeholder="أدخل كلمة المرور من التطبيق"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            />
          </label>
          <button type="submit" disabled={saving}>
            {saving ? "جارِ الحفظ..." : "حفظ إعدادات SMS"}
          </button>
        </form>
        {msg && <p style={{ color: "#2563eb" }}>{msg}</p>}
      </div>
    </div>
  );
}