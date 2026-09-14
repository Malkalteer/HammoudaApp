import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Reports() {
  const [overdue, setOverdue] = useState([]);
  const [monthly, setMonthly] = useState([]);

  const load = async () => {
    const [over, monthlyData] = await Promise.all([
      api.getOverdueReports(),
      api.getMonthlyReports(),
    ]);
    setOverdue(over);
    setMonthly(monthlyData);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="container">
      <div className="card">
        <h2>التقارير</h2>
        <h3>المتأخرون</h3>
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>رقم المشترك</th>
              <th>المتبقي</th>
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
            {overdue.length === 0 && <tr><td colSpan="3" style={{ textAlign: "center" }}>لا توجد بيانات</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>الإيراد الشهري</h3>
        <table>
          <thead>
            <tr>
              <th>الشهر</th>
              <th>إجمالي الفاتورة</th>
              <th>المدفوع</th>
              <th>المتبقي</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((row) => (
              <tr key={row._id}>
                <td>{row._id}</td>
                <td>{row.totalInvoice}</td>
                <td>{row.totalPaid}</td>
                <td>{row.totalDue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
