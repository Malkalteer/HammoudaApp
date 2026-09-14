import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function AdminStocktake() {
  const [requests, setRequests] = useState([]);
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      setRequests(await api.getStocktakeRequests());
    } catch (error) {
      setMsg(error.message);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    try {
      await api.approveStocktake(id);
      setMsg("تم تأكيد الجرد وترحيله، وتم تنزيل ملف Excel بالبيانات السابقة تلقائيا");
      load();
    } catch (error) {
      setMsg(error.message);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>موافقة الإدارة على الجرد</h2>
        {msg && <p style={{ color: "#2563eb" }}>{msg}</p>}
        {!requests.length && <p>لا توجد طلبات جرد بانتظار الموافقة.</p>}
        {requests.map((request) => (
          <div className="card" key={request._id}>
            <p>أرسل الطلب: {request.requestedBy?.name || request.requestedBy?.username || "-"}</p>
            <p>عدد المشتركين: {request.items.length}</p>
            <p>بعد التأكيد سيتم إنشاء الفواتير، خصم الخارج من الصندوق، وبدء حساب جديد.</p>
            <button onClick={() => approve(request._id)}>تأكيد الجرد وترحيله</button>
          </div>
        ))}
      </div>
    </div>
  );
}
