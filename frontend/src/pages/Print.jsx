import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";

export default function Print() {
  const { cycleId } = useParams();
  const [cycle, setCycle] = useState(null);

  useEffect(() => {
    api.getCycle(cycleId).then(setCycle);
  }, [cycleId]);

  if (!cycle) return <div className="container">جارِ التحميل...</div>;
  const s = cycle.subscriber;

  return (
    <div className="container">
      {/* إضافة التنسيقات مباشرة لحل مشكلة الطباعة */}
      <style>{`
        /* تنسيقات الشاشة العادية */
        .container {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
        }
        .receipt {
          width: 58mm;
          padding: 5mm;
          background: #fff;
          border: 1px solid #ccc;
          font-family: sans-serif;
          direction: rtl;
        }
        .row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          font-size: 12px;
        }
        .btn-print {
          margin-bottom: 12px;
          padding: 8px 16px;
          cursor: pointer;
        }

        /* تنسيقات خاصة بالطباعة فقط */
        @media print {
          @page {
            size: 58mm auto; /* ضبط قياس الورقة ليناسب طابعة 58mm */
            margin: 0;       /* إلغاء هوامش المتصفح الافتراضية */
          }
          body {
            margin: 0;
            padding: 0;
            background: #fff;
          }
          .btn-print {
            display: none; /* إخفاء زر الطباعة أثناء الطباعة */
          }
          .container {
            padding: 0;
            margin: 0;
            width: 100%;
          }
          .receipt {
            width: 58mm;
            margin: 0 auto;  /* محاذاة الفاتورة في المنتصف */
            padding: 4mm 3mm; /* إضافة حواف داخلية لحماية الأرقام من الاقتصاص */
            box-sizing: border-box;
            border: none;
          }
        }
      `}</style>

      <button className="btn-print" onClick={() => window.print()}>طباعة</button>
      <div className="receipt">
        <h3 style={{ textAlign: "center", margin: "5px 0" }}>فاتورة استهلاك كهرباء</h3>
        <hr style={{ borderStyle: "dashed" }} />
        <div className="row"><span>رقم المشترك:</span><span>{s.subscriberId}</span></div>
        <div className="row"><span>الاسم:</span><span>{s.name}</span></div>
        <div className="row"><span>رقم التابلو:</span><span>{s.panelNumber || "-"}</span></div>
        <hr style={{ borderStyle: "dashed" }} />
        <div className="row"><span>التأشيرة السابقة:</span><span>{cycle.previousPreviousReading || cycle.previousReading}</span></div>
        <div className="row"><span>التأشيرة الحالية:</span><span>{cycle.currentReading}</span></div>
        <div className="row"><span>الاستهلاك:</span><span>{cycle.consumption}</span></div>
        <hr style={{ borderStyle: "dashed" }} />
        <div className="row"><span>الرصيد السابق:</span><span>{cycle.previousBalance}</span></div>
        <div className="row"><span>فاتورة هذا الأسبوع:</span><span>{cycle.invoiceAmount}</span></div>
        <div className="row"><b>المطلوب الكلي:</b><b>{cycle.totalDue}</b></div>
        <hr style={{ borderStyle: "dashed" }} />
        <div className="row"><span>المدفوع:</span><span>{cycle.paidAmount}</span></div>
        <div className="row"><b>المتبقي:</b><b>{cycle.remainingBalance}</b></div>
        <hr style={{ borderStyle: "dashed" }} />
        <p style={{ textAlign: "center", fontSize: "11px", margin: "5px 0" }}>{new Date().toLocaleString("ar-EG")}</p>
      </div>
    </div>
  );
}