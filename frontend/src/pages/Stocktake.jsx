import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Stocktake() {
  const [subscribers, setSubscribers] = useState([]);
  const [readings, setReadings] = useState({});
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const list = await api.getSubscribers();
    setSubscribers(list);

    const defaults = {};
    list.forEach((s) => {
      defaults[s._id] = "";
    });
    setReadings(defaults);
  };

  useEffect(() => { load(); }, []);

  const downloadTemplate = async () => {
    try {
      const blob = await api.downloadStocktakeTemplate();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fatura-stocktake-template-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMsg("تم تنزيل قالب الجرد");
    } catch (err) {
      setMsg(err.message);
    }
  };

  const importExcel = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const result = await api.importStocktakeExcel(file);
      setReadings((prev) => ({ ...prev, ...result.readings }));
      const details = [
        `تمت مطابقة ${result.matchedCount} مشترك`,
        result.missing.length ? `ناقص: ${result.missing.length}` : "",
        result.unmatched.length ? `غير مطابق: ${result.unmatched.length}` : "",
        result.invalid.length ? `قراءات غير صالحة: ${result.invalid.length}` : "",
      ].filter(Boolean).join(" | ");
      setMsg(details || "لم تتم مطابقة أي مشترك");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setUploading(false);
    }
  };

  const updateReading = (subscriberId, value) => {
    setReadings((prev) => ({
      ...prev,
      [subscriberId]: value,
    }));
  };

  const saveStocktake = async () => {
    const missing = subscribers.filter((s) => {
      const value = readings[s._id];
      return value === "" || value === undefined || value === null;
    });
    if (missing.length > 0) {
      setMsg(`لا يمكن إرسال الجرد: التاشيرة ناقصة للمشترك ${missing[0].name}`);
      return;
    }

    const invalid = subscribers.filter((s) => {
      const value = readings[s._id];
      if (value === "" || value === undefined || value === null) return false;
      const currentValue = Number(s.currentReading ?? s.lastReading ?? 0);
      return Number(value) < currentValue;
    });

    if (invalid.length > 0) {
      setMsg(`لا يمكن إدخال قراءة جديدة أقل من القراءة الحالية للمشترك: ${invalid[0].name}`);
      return;
    }

    const payload = subscribers
      .filter((s) => readings[s._id] !== "" && readings[s._id] !== undefined && readings[s._id] !== null)
      .map((s) => ({
        subscriberId: s._id,
        currentReading: Number(readings[s._id]),
      }));

    if (payload.length === 0) {
      setMsg("يرجى إدخال التاشيرات الجديدة أولاً قبل الحفظ");
      return;
    }

    setLoading(true);
    try {
      await api.submitStocktakeRequest(payload);
      setMsg("تم إرسال الجرد إلى صفحة الإدارة بانتظار موافقة الأدمن");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>صفحة الجرد</h2>
        {msg && <p style={{ color: "#2563eb" }}>{msg}</p>}

        <div style={{ marginBottom: 12 }}>
          <button type="button" onClick={downloadTemplate} disabled={uploading}>تنزيل قالب Excel</button>{" "}
          <label style={{ display: "inline-block" }}>
            <input type="file" accept=".xlsx,.xls" onChange={importExcel} disabled={uploading} style={{ display: "none" }} />
            <span className="button-like">{uploading ? "جارِ قراءة الملف..." : "رفع ملف Excel"}</span>
          </label>{" "}
          <button onClick={saveStocktake} disabled={loading}>
            {loading ? "جارِ إرسال الجرد..." : "إرسال الجرد للموافقة"}
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>رقم التابلو</th>
              <th>التاشيرة الحالية</th>
              <th>التاشيرة الجديدة</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((s) => {
              const currentValue = Number(s.currentReading ?? s.lastReading ?? 0);
              const enteredValue = readings[s._id];
              const invalidValue = enteredValue !== "" && enteredValue !== undefined && enteredValue !== null && Number(enteredValue) < currentValue;

              return (
                <tr key={s._id}>
                  <td>{s.name}</td>
                  <td>{s.panelNumber || "-"}</td>
                  <td>{s.currentReading ?? s.lastReading ?? 0}</td>
                  <td>
                    <input
                      type="number"
                      value={readings[s._id] ?? ""}
                      onChange={(e) => updateReading(s._id, e.target.value)}
                      placeholder="أدخل القراءة الجديدة"
                      style={{
                        width: 140,
                        borderColor: invalidValue ? "#dc2626" : "#d1d5db",
                        boxShadow: invalidValue ? "0 0 0 1px #dc2626" : "none",
                        background: invalidValue ? "#fef2f2" : "#fff",
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
