import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

export default function Subscribers() {
  const pageSize = 100;
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState([]);
  const [payments, setPayments] = useState({});
  const [paying, setPaying] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", panelNumber: "", currentReading: "", phone: "" });
  const [msg, setMsg] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [printCycle, setPrintCycle] = useState(null);

  const load = async () => {
    try {
      const result = await api.getSubscribers(q, statusFilter, page, pageSize);
      if (Array.isArray(result)) {
        const start = (page - 1) * pageSize;
        setList(result.slice(start, start + pageSize));
        setTotalPages(Math.max(Math.ceil(result.length / pageSize), 1));
      } else {
        setList(Array.isArray(result.items) ? result.items : []);
        setTotalPages(Number(result.totalPages) || 1);
      }
    } catch (err) {
      setList([]);
      setTotalPages(1);
      setMsg(err.message);
    }
  };
  useEffect(() => { load(); }, [q, statusFilter, page]);

  useEffect(() => {
    if (!printCycle) return;
    const printTimer = window.setTimeout(() => window.print(), 0);
    return () => window.clearTimeout(printTimer);
  }, [printCycle]);

  const toggleSelect = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.createSubscriber({
        name: form.name,
        panelNumber: form.panelNumber,
        currentReading: Number(form.currentReading || 0),
        phone: form.phone,
      });
      setForm({ name: "", panelNumber: "", currentReading: "", phone: "" });
      setShowAdd(false);
      load();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const handlePay = async (subscriber) => {
    if (paying[subscriber._id]) return;
    const amount = Number(payments[subscriber._id] || 0);
    if (!amount || amount <= 0) {
      setMsg("أدخل مبلغًا صحيحًا للدفع");
      return;
    }
    if (!subscriber.lastCycleId) {
      setMsg("لا توجد فاتورة حالية لهذا المشترك");
      return;
    }

    setPaying((prev) => ({ ...prev, [subscriber._id]: true }));
    try {
      const cycle = await api.pay(subscriber.lastCycleId, amount);
      setPayments((prev) => ({ ...prev, [subscriber._id]: "" }));
      setMsg(cycle.sms?.ok
        ? "تم تسجيل الدفعة وإرسال رسالة SMS بنجاح"
        : `تم تسجيل الدفعة، لكن لم تُرسل رسالة SMS: ${cycle.sms?.error || "تحقق من رقم الهاتف وإعدادات البوابة"}`);
      setPrintCycle({ cycle, subscriber });
      load();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setPaying((prev) => ({ ...prev, [subscriber._id]: false }));
    }
  };

  const sendToCutPage = async () => {
    if (selected.length === 0) return;
    await api.markDisconnect(selected);
    setSelected([]);
    setMsg("تم إرسال المختارين إلى صفحة القطع");
    load();
  };

  const paymentRowClass = (subscriber) => {
    if (!subscriber.paidAmount) return "";
    if (subscriber.remainingBalance < 0) return "payment-overpaid";
    if (Math.abs(subscriber.remainingBalance) < 0.000001) return "payment-paid";
    return "payment-partial";
  };

  return (
    <div className="container">
      <div className="card">
        <div className="page-heading">
          <h2>المشتركون</h2>
          <div className="action-row">
            <button onClick={() => setShowAdd((s) => !s)}>+ إضافة مشترك جديد</button>{" "}
            <Link to="/cut-list"><button>صفحة القطع</button></Link>
          </div>
        </div>

        {showAdd && (
          <form onSubmit={handleAdd} className="form-row">
            <input placeholder="اسم المشترك" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input placeholder="رقم التابلو" required value={form.panelNumber}
              onChange={(e) => setForm({ ...form, panelNumber: e.target.value })} />
            <input placeholder="التاشيرة الحالية" type="number" required value={form.currentReading}
              onChange={(e) => setForm({ ...form, currentReading: e.target.value })} />
            <input placeholder="رقم الهاتف (للـ SMS)" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <button type="submit">حفظ</button>
          </form>
        )}

        <div className="filter-row">
          <input
            className="search-input"
            placeholder="بحث بالاسم أو رقم المشترك..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <select value={statusFilter} onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}>
            <option value="all">الكل</option>
            <option value="overdue">متأخرون</option>
            <option value="connected">متصلون</option>
            <option value="disconnected">مقطوعون</option>
          </select>
        </div>
        {msg && <p style={{ color: "#2563eb" }}>{msg}</p>}
      </div>

      <div className="card subscribers-card">
        <div className="toolbar">
          <button disabled={selected.length === 0} onClick={sendToCutPage}>
            إرسال المختارين ({selected.length}) إلى صفحة القطع
          </button>
        </div>
        <table className="subscribers-table">
          <thead>
            <tr>
              <th></th>
              <th>الرقم</th>
              <th>الاسم</th>
              <th>التابلو</th>
              <th>الهاتف</th>
              <th>التاشيرة السابقة</th>
              <th>التاشيرة الحالية</th>
              <th>الاستهلاك</th>
              <th>الحساب السابق</th>
              <th>الحساب الحالي</th>
              <th>الحساب الكلي</th>
              <th>الدفع</th>
              <th>الرصيد</th>
              <th>الحالة</th>
              <th>تم الدفع بواسطة</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s._id} className={paymentRowClass(s)}>
                <td><input type="checkbox" checked={selected.includes(s._id)} onChange={() => toggleSelect(s._id)} /></td>
                <td>{s.subscriberId}</td>
                <td><Link to={`/subscriber/${s._id}`}>{s.name}</Link></td>
                <td>{s.panelNumber || "-"}</td>
                <td>{s.phone || "-"}</td>
                <td>{s.previousReading ?? 0}</td>
                <td>{s.currentReading ?? 0}</td>
                <td>{s.consumption ?? 0}</td>
                <td>{s.previousBalance ?? 0}</td>
                <td>{s.currentInvoice ?? 0}</td>
                <td>{s.totalAccount ?? s.balance ?? 0}</td>
                <td>
                  <div className="payment-row">
                    <input
                      type="number"
                      min="0"
                      placeholder="مبلغ"
                      value={payments[s._id] ?? ""}
                      onChange={(e) => setPayments((prev) => ({ ...prev, [s._id]: e.target.value }))}
                      className="payment-input"
                    />
                    <button type="button" disabled={paying[s._id]} onClick={() => handlePay(s)}>
                      {paying[s._id] ? "جارِ التسجيل..." : "دفع"}
                    </button>
                  </div>
                </td>
                <td>{s.balance}</td>
                <td style={{ color: s.connectionStatus === "مقطوع" ? "#dc2626" : "#16a34a" }}>
                  {s.connectionStatus}
                </td>
                <td>{s.lastPaymentBy || s.paidByName || s.paidByUsername || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="toolbar" style={{ justifyContent: "center" }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            السابق
          </button>
          <span>صفحة {page} من {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
            التالي
          </button>
        </div>
      </div>

      {printCycle && (
        <div className="receipt direct-print-receipt">
          <h3 style={{ textAlign: "center", margin: "5px 0" }}>فاتورة استهلاك كهرباء</h3>
          <hr style={{ borderStyle: "dashed" }} />
          <div className="row"><span>رقم المشترك:</span><span>{printCycle.subscriber.subscriberId}</span></div>
          <div className="row"><span>الاسم:</span><span>{printCycle.subscriber.name}</span></div>
          <div className="row"><span>رقم التابلو:</span><span>{printCycle.subscriber.panelNumber || "-"}</span></div>
          <hr style={{ borderStyle: "dashed" }} />
          <div className="row"><span>التأشيرة السابقة:</span><span>{printCycle.cycle.previousPreviousReading || printCycle.cycle.previousReading}</span></div>
          <div className="row"><span>التأشيرة الحالية:</span><span>{printCycle.cycle.currentReading}</span></div>
          <div className="row"><span>الاستهلاك:</span><span>{printCycle.cycle.consumption}</span></div>
          <hr style={{ borderStyle: "dashed" }} />
          <div className="row"><span>الرصيد السابق:</span><span>{printCycle.cycle.previousBalance}</span></div>
          <div className="row"><span>فاتورة هذا الأسبوع:</span><span>{printCycle.cycle.invoiceAmount}</span></div>
          <div className="row"><b>المطلوب الكلي:</b><b>{printCycle.cycle.totalDue}</b></div>
          <hr style={{ borderStyle: "dashed" }} />
          <div className="row"><span>المدفوع:</span><span>{printCycle.cycle.paidAmount}</span></div>
          <div className="row"><b>المتبقي:</b><b>{printCycle.cycle.remainingBalance}</b></div>
          <hr style={{ borderStyle: "dashed" }} />
          <p style={{ textAlign: "center", fontSize: "11px", margin: "5px 0" }}>{new Date().toLocaleString("ar-EG")}</p>
        </div>
      )}
    </div>
  );
}
