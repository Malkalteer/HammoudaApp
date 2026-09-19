import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function CutList() {
  const [requiredDisconnect, setRequiredDisconnect] = useState([]);
  const [cutList, setCutList] = useState([]);
  const [pendingReconnect, setPendingReconnect] = useState([]);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const [requiredList, actualCutList, reconnectList] = await Promise.all([
      api.getRequiredDisconnectList(),
      api.getCutList(),
      api.getPendingReconnectList(),
    ]);
    setRequiredDisconnect(requiredList);
    setCutList(actualCutList);
    setPendingReconnect(reconnectList);
  };
  useEffect(() => { load(); }, []);

  const confirmDisconnect = async (id) => {
    try {
      await api.confirmDisconnect(id);
      setMsg("تم تسجيل القطع ونقل المشترك إلى جدول المقطوعين");
      load();
    } catch (error) {
      setMsg(error.message);
    }
  };

  const sendToReconnect = async (id) => {
    try {
      await api.sendToReconnect(id);
      setMsg("تم تحويل المشترك إلى جدول الوصل");
      load();
    } catch (error) {
      setMsg(error.message);
    }
  };

  const handleReconnect = async (id) => {
    try {
      await api.reconnect(id);
      setMsg("تم تأكيد الوصل وإخفاء المشترك من جدول الوصل");
      load();
    } catch (error) {
      setMsg(error.message);
    }
  };

  const renderMobileList = (items, emptyMessage, actionLabel, actionHandler) => (
    <div className="cut-mobile-list">
      {items.map((subscriber) => (
        <article className="cut-mobile-item" key={subscriber._id}>
          <div className="cut-mobile-heading">
            <div className="cut-mobile-name">
              <strong>{subscriber.name}</strong>
              <span><b>رقم التابلو</b>{subscriber.panelNumber || "-"}</span>
            </div>
          </div>
          <button className="cut-mobile-action" onClick={() => actionHandler(subscriber._id)}>
            {actionLabel}
          </button>
        </article>
      ))}
      {items.length === 0 && <p className="cut-mobile-empty">{emptyMessage}</p>}
    </div>
  );

  return (
    <div className="cut-page">
      <div className="cut-panel cut-intro-panel">
        <h2>صفحة القطع</h2>
        <p>قائمة المشتركين المطلوب قطع الكهرباء عنهم. بعد تنفيذ القطع اضغط على زر تم القطع.</p>
        {msg && <p className="cut-message">{msg}</p>}
        <table className="cut-table">
          <thead>
            <tr>
              <th>الرقم</th>
              <th>الاسم</th>
              <th>رقم التابلو</th>
              
              <th>الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {requiredDisconnect.map((s) => (
              <tr key={s._id}>
                <td>{s.subscriberId}</td>
                <td>{s.name}</td>
                <td>{s.panelNumber || "-"}</td>
                
                <td><button onClick={() => confirmDisconnect(s._id)}>تم القطع</button></td>
              </tr>
            ))}
            {requiredDisconnect.length === 0 && (
              <tr><td colSpan="5" className="empty-cell">لا يوجد مشتركون بانتظار القطع حاليًا</td></tr>
            )}
          </tbody>
        </table>
        {renderMobileList(
          requiredDisconnect,
          "لا يوجد مشتركون بانتظار القطع حاليًا",
          "تم القطع",
          confirmDisconnect
        )}
      </div>

      <div className="cut-panel">
        <div className="cut-panel-heading">
          <div>
            <h2>جدول المقطوعين</h2>
            <p>المشتركون الذين تم قطع الكهرباء عنهم فعليًا. بعد طلب إعادة الوصل، انقل الاسم إلى جدول الوصل.</p>
          </div>
          <span className="cut-count">{cutList.length} تم قطعهم</span>
        </div>
        <table className="cut-table">
          <thead>
            <tr>
              <th>الرقم</th>
              <th>الاسم</th>
              <th>رقم التابلو</th>
              
              <th>الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {cutList.map((s) => (
              <tr key={s._id}>
                <td>{s.subscriberId}</td>
                <td>{s.name}</td>
                <td>{s.panelNumber || "-"}</td>
                
                <td><button onClick={() => sendToReconnect(s._id)}>تحويل إلى جدول الوصل</button></td>
              </tr>
            ))}
            {cutList.length === 0 && (
              <tr><td colSpan="5" className="empty-cell">لا يوجد مشتركون تم قطعهم حاليًا</td></tr>
            )}
          </tbody>
        </table>
        {renderMobileList(
          cutList,
          "لا يوجد مشتركون تم قطعهم حاليًا",
          "تحويل إلى جدول الوصل",
          sendToReconnect
        )}
      </div>

      <div className="cut-panel">
        <div className="cut-panel-heading">
          <div>
            <h2>جدول الوصل</h2>
            <p>هذه قائمة المشتركين الذين تم قطع الكهرباء عنهم وينتظرون وصول العامل لإعادة التوصيل.</p>
          </div>
          <span className="cut-count">{pendingReconnect.length} بانتظار الوصل</span>
        </div>
        <table className="cut-table">
          <thead>
            <tr>
              <th>الرقم</th>
              <th>الاسم</th>
              <th>رقم التابلو</th>
              
              <th>الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {pendingReconnect.map((s) => (
              <tr key={s._id}>
                <td>{s.subscriberId}</td>
                <td>{s.name}</td>
                <td>{s.panelNumber || "-"}</td>
                
                <td><button onClick={() => handleReconnect(s._id)}>تم الوصل</button></td>
              </tr>
            ))}
            {pendingReconnect.length === 0 && (
              <tr><td colSpan="5" className="empty-cell">لا يوجد مشتركون بانتظار الوصل حاليًا</td></tr>
            )}
          </tbody>
        </table>
        {renderMobileList(
          pendingReconnect,
          "لا يوجد مشتركون بانتظار الوصل حاليًا",
          "تم الوصل",
          handleReconnect
        )}
      </div>
    </div>
  );
}
