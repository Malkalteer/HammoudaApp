import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function SubscriberDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", panelNumber: "", phone: "" });
  const [reading, setReading] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [editedPayment, setEditedPayment] = useState("");
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const result = await api.getSubscriber(id);
    setData(result);
    setEditForm({
      name: result.subscriber.name || "",
      panelNumber: result.subscriber.panelNumber || "",
      phone: result.subscriber.phone || "",
    });
    setEditedPayment("");
  };
  useEffect(() => { load(); }, [id]);

  if (!data) return <div className="container">جارِ التحميل...</div>;
  const { subscriber, lastCycle } = data;

  const submitReading = async (e) => {
    e.preventDefault();
    const weekLabel = new Date().toISOString().slice(0, 10);
    const cycle = await api.addReading(id, { currentReading: Number(reading), weekLabel });
    setReading("");
    setMsg("تم إنشاء الفاتورة الأسبوعية بنجاح");
    load();
    navigate(`/print/${cycle._id}`);
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    if (!lastCycle || isPaying) return;
    setIsPaying(true);
    try {
      await api.pay(lastCycle._id, Number(payAmount));
      setPayAmount("");
      setMsg("تم تسجيل الدفعة");
      load();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setIsPaying(false);
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    await api.updateSubscriber(id, {
      name: editForm.name,
      panelNumber: editForm.panelNumber,
      phone: editForm.phone,
    });
    setMsg("تم تعديل بيانات المشترك");
    load();
  };

  const submitPaymentEdit = async (e) => {
    e.preventDefault();
    if (!lastCycle || editedPayment === "" || Number(editedPayment) === 0 || isEditingPayment) return;
    setIsEditingPayment(true);
    try {
      await api.updateLastPayment(lastCycle._id, Number(editedPayment));
      setEditedPayment("");
      setMsg("تم تعديل آخر دفعة وتصحيح الحساب والمالية");
      load();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setIsEditingPayment(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("هل تريد حذف هذا المشترك نهائيًا؟")) return;
    await api.deleteSubscriber(id);
    navigate("/subscribers");
  };

  return (
    <div className="container">
      <div className="card">
        <h2>{subscriber.name} — رقم {subscriber.subscriberId}</h2>
        <p>رقم التابلو: {subscriber.panelNumber || "-"} | الحالة: {subscriber.connectionStatus}</p>
        <p>رقم الهاتف: {subscriber.phone || "-"}</p>
        <p>الرصيد الحالي المستحق: <b>{subscriber.balance}</b></p>
        {msg && <p style={{ color: "#2563eb" }}>{msg}</p>}
      </div>

      <div className="card">
        <h3>تعديل بيانات المشترك</h3>
        <form onSubmit={submitEdit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="اسم المشترك"
            required
            value={editForm.name}
            onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <input
            placeholder="رقم التابلو"
            value={editForm.panelNumber}
            onChange={(e) => setEditForm((prev) => ({ ...prev, panelNumber: e.target.value }))}
          />
          <input
            placeholder="رقم الهاتف"
            value={editForm.phone}
            onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
          />
          <button type="submit">حفظ التعديلات</button>
          {user?.role === "admin" && (
            <button type="button" onClick={handleDelete} style={{ background: "#dc2626" }}>حذف المشترك</button>
          )}
        </form>
      </div>

      {lastCycle && (
        <div className="card">
          <h3>آخر فاتورة (دورة {lastCycle.weekLabel})</h3>
          <p>الاستهلاك: {lastCycle.consumption} | المطلوب الكلي: {lastCycle.totalDue}</p>
          <p>المدفوع: {lastCycle.paidAmount} | المتبقي: {lastCycle.remainingBalance} | الحالة: {lastCycle.status}</p>
          <form onSubmit={submitPayment} style={{ display: "flex", gap: 8 }}>
            <input placeholder="المبلغ المدفوع الآن" required type="number" value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)} />
            <button type="submit" disabled={isPaying}>
              {isPaying ? "جارِ التسجيل..." : "تسجيل الدفعة"}
            </button>
            <button type="button" onClick={() => navigate(`/print/${lastCycle._id}`)}>طباعة الإيصال</button>
          </form>
          {user?.role === "admin" && (
            <form onSubmit={submitPaymentEdit} style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                placeholder="قيمة التصحيح (+ أو -)"
                required
                step="any"
                type="number"
                value={editedPayment}
                onChange={(e) => setEditedPayment(e.target.value)}
              />
              <button type="submit" disabled={isEditingPayment}>
                {isEditingPayment ? "جارِ التعديل..." : "تعديل آخر دفعة"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
