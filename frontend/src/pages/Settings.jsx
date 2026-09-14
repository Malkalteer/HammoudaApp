import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Settings() {
  const [form, setForm] = useState({ url: "", token: "" });
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
        <h3>بوابة رسائل SMS</h3>
        <p>تُستخدم هذه البيانات لإرسال تفاصيل الدفع تلقائيًا بعد نجاح الدفع.</p>
        <form onSubmit={save} className="auth-form">
          <label>
            رابط بوابة الهاتف
            <input
              type="url"
              required
              placeholder="http://192.168.1.114:8082"
              value={form.url}
              onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
            />
          </label>
          <label>
            Token البوابة
            <input
              type="password"
              required
              autoComplete="off"
              placeholder="أدخل Token بوابة الهاتف"
              value={form.token}
              onChange={(event) => setForm((prev) => ({ ...prev, token: event.target.value }))}
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
