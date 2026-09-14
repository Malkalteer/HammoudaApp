import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function SmsPanel() {
  const [subscribers, setSubscribers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState("مرحباً، يوجد رصيد مستحق يرجى السداد في أقرب وقت.");
  const [logs, setLogs] = useState([]);

  const load = async () => {
    const [subs, smsLogs] = await Promise.all([
      api.getSubscribers(),
      api.getSmsLogs(),
    ]);
    setSubscribers(subs);
    setLogs(smsLogs);
  };

  useEffect(() => { load(); }, []);

  const toggle = (id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const send = async () => {
    if (!selected.length) return;
    await api.sendSmsBulk({ ids: selected, message });
    setSelected([]);
    load();
  };

  return (
    <div className="container">
      <div className="card">
        <h2>إرسال رسائل SMS</h2>
        <textarea rows="4" value={message} onChange={(e) => setMessage(e.target.value)} style={{ width: "100%" }} />
        <button onClick={send} disabled={selected.length === 0}>إرسال إلى المختارين</button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>الاسم</th>
              <th>رقم المشترك</th>
              <th>الهاتف</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((s) => (
              <tr key={s._id}>
                <td><input type="checkbox" checked={selected.includes(s._id)} onChange={() => toggle(s._id)} /></td>
                <td>{s.name}</td>
                <td>{s.subscriberId}</td>
                <td>{s.phone || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>سجل الرسائل</h3>
        <table>
          <thead>
            <tr>
              <th>المشترك</th>
              <th>الهاتف</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id}>
                <td>{log.subscriberId || "—"}</td>
                <td>{log.phone}</td>
                <td>{log.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
