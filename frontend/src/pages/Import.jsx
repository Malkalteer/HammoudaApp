import { useState } from "react";
import { api } from "../api.js";

export default function Import() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await api.importExcel(file);
      setResult(res);
    } catch (err) {
      setResult({ error: err.message });
    }
    setLoading(false);
  };

  return (
    <div className="container">
      <div className="card">
        <h2>استيراد بيانات المشتركين من ملف Excel القديم</h2>
        <p>اختر ملف .xlsm أو .xlsx الذي يحتوي شيت "Main" بنفس تنسيق ملفك الحالي. يتم الاستيراد مرة واحدة فقط عند التشغيل الأول.</p>
        <input type="file" accept=".xlsx,.xlsm" onChange={(e) => setFile(e.target.files[0])} />
        <button onClick={handleImport} disabled={!file || loading} style={{ marginRight: 8 }}>
          {loading ? "جارِ الاستيراد..." : "بدء الاستيراد"}
        </button>

        {result && !result.error && (
          <p style={{ color: "green" }}>تم استيراد {result.imported} مشترك، وتخطي {result.skipped} (موجود مسبقًا أو بيانات ناقصة).</p>
        )}
        {result?.error && <p style={{ color: "red" }}>خطأ: {result.error}</p>}
      </div>
    </div>
  );
}
