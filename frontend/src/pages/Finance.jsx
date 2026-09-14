import { useEffect, useState } from "react";
import { api } from "../api.js";

const money = (value) => Number(value || 0).toLocaleString("ar-IQ");

export default function Finance() {
  const [data, setData] = useState(null);
  const [cashOut, setCashOut] = useState("");
  const [cashOutReason, setCashOutReason] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => setData(await api.getFinanceSummary());
  useEffect(() => { load(); }, []);

  const submitCashOut = async (event) => {
    event.preventDefault();
    try {
      await api.addCashOut(Number(cashOut), cashOutReason);
      setCashOut("");
      setCashOutReason("");
      setMsg("تم تسجيل المبلغ الخارج من الدرج");
      load();
    } catch (error) {
      setMsg(error.message);
    }
  };

  const closeDay = async () => {
    await api.closeFinanceDay();
    setMsg("تم تصفير حركة اليوم وإقفاله. تبدأ دفعات اليوم التالي من الصفر.");
    load();
  };

  if (!data) return <div className="container">جارِ التحميل...</div>;
  const { summary, recentCycles, allCycles, cashOutOperations, dateKey, day } = data;

  return (
    <div className="container">
      <div className="card">
        <h2>المالية والصندوق العام</h2>
        <p>اليوم المالي: {dateKey}</p>
        <div className="grid">
          <div className="stat-box"><span>باقي حساب الجمعة السابقة</span><strong>{money(summary.previousBalance)}</strong></div>
          <div className="stat-box"><span>حساب الجمعة الحالية</span><strong>{money(summary.currentInvoiceTotal)}</strong></div>
          <div className="stat-box"><span>الصندوق العام</span><strong>{money(summary.generalFund)}</strong></div>
          <div className="stat-box"><span>المدفوعون اليوم</span><strong>{money(summary.paidToday)}</strong></div>
          <div className="stat-box"><span>الباقي الصافي</span><strong>{money(summary.remainingBalance)}</strong></div>
          <div className="stat-box"><span>الخارج من الدرج</span><strong>{money(summary.cashOut)}</strong></div>
          <div className="stat-box"><span>درج المال الحالي</span><strong>{money(summary.cashDrawer)}</strong></div>
        </div>
      </div>

      <div className="card">
        <h3>إخراج مبلغ من الدرج</h3>
        <form onSubmit={submitCashOut} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="number" min="0.01" step="0.01" required placeholder="المبلغ الخارج" value={cashOut} onChange={(e) => setCashOut(e.target.value)} />
          <input type="text" required placeholder="سبب الإخراج أو الملاحظة" value={cashOutReason} onChange={(e) => setCashOutReason(e.target.value)} />
          <button type="submit">تسجيل الخارج</button>
          <button type="button" onClick={closeDay}>إقفال اليوم</button>
        </form>
        {msg && <p style={{ color: "#2563eb" }}>{msg}</p>}
        {day.closedAt && <p>تم إقفال هذا اليوم في {new Date(day.closedAt).toLocaleString("ar-IQ")}</p>}
      </div>

      <div className="card">
        <h3>سجل المبالغ الخارجة</h3>
        <table>
          <thead><tr><th>التاريخ</th><th>الوقت</th><th>المبلغ</th><th>الملاحظة</th></tr></thead>
          <tbody>
            {cashOutOperations.map((operation) => (
              <tr key={operation._id}>
                <td>{operation.dateKey}</td>
                <td>{new Date(operation.createdAt).toLocaleString("ar-IQ")}</td>
                <td>{money(operation.amount)}</td>
                <td>{operation.reason}</td>
              </tr>
            ))}
            {!cashOutOperations.length && <tr><td colSpan="4" style={{ textAlign: "center" }}>لا توجد مبالغ خارجة مسجلة</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>فواتير اليوم</h3>
        <table>
          <thead><tr><th>المشترك</th><th>رقم المشترك</th><th>الفاتورة الحالية</th><th>المطلوب الكلي</th><th>المدفوع</th><th>المتبقي</th></tr></thead>
          <tbody>
            {recentCycles.map((cycle) => (
              <tr key={cycle._id}>
                <td>{cycle.subscriber?.name || "-"}</td>
                <td>{cycle.subscriberId}</td>
                <td>{money(cycle.invoiceAmount)}</td>
                <td>{money(cycle.totalDue)}</td>
                <td>{money(cycle.paidAmount)}</td>
                <td>{money(cycle.remainingBalance)}</td>
              </tr>
            ))}
            {!recentCycles.length && <tr><td colSpan="6" style={{ textAlign: "center" }}>لا توجد فواتير لهذا اليوم</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>أرشيف جميع الفواتير</h3>
        <table>
          <thead><tr><th>التاريخ</th><th>المشترك</th><th>رقم المشترك</th><th>الحساب السابق</th><th>الحساب الحالي</th><th>الحساب الكلي</th><th>المدفوع</th><th>المتبقي</th></tr></thead>
          <tbody>
            {allCycles.map((cycle) => (
              <tr key={cycle._id}>
                <td>{cycle.weekLabel || new Date(cycle.createdAt).toLocaleDateString("ar-IQ")}</td>
                <td>{cycle.subscriber?.name || "-"}</td>
                <td>{cycle.subscriberId}</td>
                <td>{money(cycle.previousBalance)}</td>
                <td>{money(cycle.invoiceAmount)}</td>
                <td>{money(cycle.totalDue)}</td>
                <td>{money(cycle.paidAmount)}</td>
                <td>{money(cycle.remainingBalance)}</td>
              </tr>
            ))}
            {!allCycles.length && <tr><td colSpan="8" style={{ textAlign: "center" }}>لا توجد فواتير محفوظة</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
