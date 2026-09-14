import { useEffect, useState } from "react";
import { api } from "../api.js";

const emptyForm = { name: "", username: "", password: "", role: "electrician", phone: "" };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");

  const load = () => api.getUsers().then(setUsers).catch((error) => setMessage(error.message));
  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      if (editingId) {
        await api.updateUser(editingId, { name: form.name, role: form.role, phone: form.phone });
      } else {
        await api.register(form);
      }
      setForm(emptyForm);
      setEditingId(null);
      setMessage("تم حفظ الحساب");
      load();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const edit = (user) => {
    setForm({ name: user.name, username: user.username, password: "", role: user.role, phone: user.phone || "" });
    setEditingId(user._id);
  };
  const toggle = async (user) => {
    try {
      await api.updateUser(user._id, { active: !user.active });
      load();
    } catch (error) { setMessage(error.message); }
  };

  return <div className="container">
    <div className="card">
      <h2>{editingId ? "تعديل الحساب" : "إضافة حساب"}</h2>
      <form onSubmit={submit} className="auth-form">
        <input required placeholder="الاسم الكامل" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        {!editingId && <input required placeholder="اسم المستخدم" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />}
        {!editingId && <input required type="password" placeholder="كلمة المرور المبدئية" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />}
        <input placeholder="الهاتف" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
          <option value="admin">أدمن</option>
          <option value="accountant">محاسب</option>
          <option value="electrician">كهربائي</option>
        </select>
        <div className="action-row"><button type="submit">حفظ</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>إلغاء</button>}</div>
      </form>
      {message && <p className="success-message">{message}</p>}
    </div>
    <div className="card subscribers-card"><table><thead><tr><th>الاسم</th><th>المستخدم</th><th>الدور</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>
      {users.map((user) => <tr key={user._id}><td>{user.name}</td><td>{user.username}</td><td>{user.role}</td><td>{user.active ? "فعال" : "معطل"}</td><td><button type="button" onClick={() => edit(user)}>تعديل</button> <button type="button" onClick={() => toggle(user)}>{user.active ? "تعطيل" : "تفعيل"}</button></td></tr>)}
    </tbody></table></div>
  </div>;
}