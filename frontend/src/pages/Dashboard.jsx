import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [kwhPrice, setKwhPrice] = useState(1);
  const [msg, setMsg] = useState("");
  const [exporting, setExporting] = useState(false);
  const [subscribers, setSubscribers] = useState([]);
  const [customPrices, setCustomPrices] = useState([]);
  const [customSubscriberId, setCustomSubscriberId] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [dailyPaidRows, setDailyPaidRows] = useState([]);

  const getDailyRows = (savedDays) => {
    const savedByDate = new Map(savedDays.map((day) => [day.dateKey, day.dailyPaid]));
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const dateKey = date.toISOString().slice(0, 10);
      return {
        dateKey,
        dayName: date.toLocaleDateString("ar-EG", { weekday: "long" }),
        dailyPaid: savedByDate.get(dateKey) ?? 0,
      };
    });
  };

  const load = async () => {
    const dashboard = await api.getDashboard();
    setData(dashboard);
    if (user?.role === "admin") {
      const [priceData, subscriberData, customPriceData, dailyPaidData] = await Promise.all([
        api.getKwhPrice(),
        api.getSubscribers(),
        api.getCustomPrices(),
        api.getDailyPaid(),
      ]);
      setKwhPrice(Number(priceData?.value ?? 1));
      setSubscribers(
        Array.isArray(subscriberData)
          ? subscriberData
          : Array.isArray(subscriberData?.items)
          ? subscriberData.items
          : []
      );
      setCustomPrices(customPriceData);
      setDailyPaidRows(getDailyRows(dailyPaidData));
    }
  };

  const saveCustomPrice = async (e) => {
    e.preventDefault();
    const value = Number(customPrice);
    if (!customSubscriberId || !Number.isFinite(value) || value <= 0) {
      setMsg("اختر مشتركًا وأدخل سعرًا خاصًا أكبر من صفر");
      return;
    }

    await api.setCustomPrice(customSubscriberId, value);
    setCustomPrice("");
    setMsg("تم حفظ السعر الخاص للمشترك");
    load();
  };

  const removeCustomPrice = async (id) => {
    await api.setCustomPrice(id, null);
    setMsg("تم إلغاء السعر الخاص واستخدام السعر العام");
    load();
  };

  const saveKwhPrice = async (e) => {
    e.preventDefault();
    const value = Number(kwhPrice);
    if (!Number.isFinite(value) || value <= 0) {
      setMsg("سعر الكيلو الواط يجب أن يكون رقمًا أكبر من صفر");
      return;
    }

    const result = await api.setKwhPrice(value);
    setKwhPrice(Number(result.value));
    setMsg("تم تحديث سعر الكيلو الواط بنجاح");
  };

  const exportExcel = async () => {
    setExporting(true);
    setMsg("");
    try {
      await api.exportDashboardExcel();
      setMsg("تم إنشاء تقرير Excel وتنزيله بنجاح");
    } catch (error) {
      setMsg(error.message);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => { load(); }, [user?.role]);

  if (!data) return <div className="container">جارِ التحميل...</div>;

  const { summary, overdue, recent } = data;

  return (
    <div className="container">
      <div className="card">
        <h2>لوحة التحكم</h2>
        <button type="button" onClick={exportExcel} disabled={exporting}>
          {exporting ? "جارِ إنشاء التقرير..." : "إنشاء تقرير Excel الآن"}
        </button>
        <div className="grid">
          <div className="stat-box"><span>إجمالي المشتركين</span><strong>{summary.totalSubscribers}</strong></div>
          <div className="stat-box"><span>متصلين</span><strong>{summary.connected}</strong></div>
          <div className="stat-box"><span>مقطوعين</span><strong>{summary.disconnected}</strong></div>
          <div className="stat-box"><span>إجمالي الرصيد</span><strong>{summary.totalBalance}</strong></div>
          <div className="stat-box"><span>مدفوع</span><strong>{summary.paidCycles}</strong></div>
          <div className="stat-box"><span>غير مدفوع</span><strong>{summary.unpaidCycles}</strong></div>
          <div className="stat-box"><span>جزئي</span><strong>{summary.partialCycles}</strong></div>
        </div>
      </div>

      {user?.role === "admin" && <div className="card">
        <h3>سعر الكيلو الواط</h3>
        <form onSubmit={saveKwhPrice} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="number"
            min="0"
            step="1"
            value={kwhPrice}
            onChange={(e) => setKwhPrice(e.target.value)}
            style={{ width: 150 }}
          />
          <button type="submit">حفظ السعر</button>
        </form>
        {msg && <p style={{ color: "#2563eb", marginTop: 8 }}>{msg}</p>}
        <h3 style={{ marginTop: 24 }}>أسعار خاصة للمشتركين</h3>
        <form onSubmit={saveCustomPrice} className="form-row">
          <select value={customSubscriberId} onChange={(e) => setCustomSubscriberId(e.target.value)}>
            <option value="">اختر المشترك</option>
            {subscribers.map((subscriber) => (
              <option key={subscriber._id} value={subscriber._id}>
                {subscriber.subscriberId} - {subscriber.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="السعر الخاص"
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
          />
          <button type="submit">حفظ السعر الخاص</button>
        </form>
        {customPrices.length > 0 && (
          <div className="subscribers-card">
            <table>
              <thead><tr><th>المشترك</th><th>السعر الخاص</th><th>إجراء</th></tr></thead>
              <tbody>
                {customPrices.map((subscriber) => (
                  <tr key={subscriber._id}>
                    <td>{subscriber.subscriberId} - {subscriber.name}</td>
                    <td>{subscriber.customUnitPrice}</td>
                    <td><button type="button" onClick={() => removeCustomPrice(subscriber._id)}>إلغاء السعر الخاص</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}
      {user?.role === "admin" && <div className="card">
        <h3 style={{ marginTop: 24 }}>المدفوع اليومي</h3>
        <div className="subscribers-card">
          <table>
            <thead><tr><th>اليوم</th><th>التاريخ</th><th>إجمالي المدفوع</th></tr></thead>
            <tbody>
              {dailyPaidRows.map((row) => (
                <tr key={row.dateKey}>
                  <td>{row.dayName}</td>
                  <td>{row.dateKey}</td>
                  <td>{Number(row.dailyPaid || 0)}</td>
                </tr>
              ))}
              <tr>
                <th colSpan="2">المجموع</th>
                <th>{dailyPaidRows.reduce((total, row) => total + Number(row.dailyPaid || 0), 0)}</th>
              </tr>
            </tbody>
          </table>
        </div>
      </div>}

      <div className="card">
        <h3>أعلى المتأخرين</h3>
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>رقم المشترك</th>
              <th>الرصيد</th>
            </tr>
          </thead>
          <tbody>
            {overdue.map((s) => (
              <tr key={s._id}>
                <td>{s.name}</td>
                <td>{s.subscriberId}</td>
                <td>{s.balance}</td>
              </tr>
            ))}
            {overdue.length === 0 && <tr><td colSpan="3" style={{ textAlign: "center" }}>لا توجد متأخرات</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>أحدث الدفعات</h3>
        <table>
          <thead>
            <tr>
              <th>المشترك</th>
              <th>المبلغ</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((c) => (
              <tr key={c._id}>
                <td>{c.subscriber?.name || c.subscriberId}</td>
                <td>{c.paidAmount || 0}</td>
                <td>{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
