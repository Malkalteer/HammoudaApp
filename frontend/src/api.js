// يمكن تجاوز العنوان عبر VITE_API_URL عند الحاجة
const API_BASE = import.meta.env.VITE_API_URL || "https://hammoudaapp.onrender.com";

function clearSessionOnUnauthorized() {
  localStorage.removeItem("fatura_token");
  localStorage.removeItem("fatura_user");
  window.location.assign("/auth");
}

async function request(path, options = {}) {
  const token = localStorage.getItem("fatura_token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    if (res.status === 401) {
      clearSessionOnUnauthorized();
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "حدث خطأ في الاتصال بالسيرفر");
  }
  return res.json();
}

export const api = {
  login: (data) => request("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  register: (data) => request("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  getUsers: () => request("/auth/users"),
  updateUser: (id, data) => request(`/auth/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  getSubscribers: (q = "", status = "") => request(`/subscribers${q || status ? `?${[q ? `q=${encodeURIComponent(q)}` : "", status ? `status=${encodeURIComponent(status)}` : ""].filter(Boolean).join("&")}` : ""}`),
  getSubscriber: (id) => request(`/subscribers/${id}`),
  getKwhPrice: () => request(`/settings/kwh-price`),
  setKwhPrice: (value) => request(`/settings/kwh-price`, { method: "PUT", body: JSON.stringify({ value }) }),
  getCustomPrices: () => request(`/settings/custom-prices`),
  setCustomPrice: (id, value) => request(`/settings/custom-prices/${id}`, { method: "PUT", body: JSON.stringify({ value }) }),
  getSmsGateway: () => request(`/settings/sms-gateway`),
  setSmsGateway: (data) => request(`/settings/sms-gateway`, { method: "PUT", body: JSON.stringify(data) }),
  createSubscriber: (data) => request(`/subscribers`, { method: "POST", body: JSON.stringify(data) }),
  updateSubscriber: (id, data) => request(`/subscribers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSubscriber: (id) => request(`/subscribers/${id}`, { method: "DELETE" }),
  getRequiredDisconnectList: () => request(`/subscribers/status/required-disconnect`),
  getCutList: () => request(`/subscribers/status/cut`),
  getPendingReconnectList: () => request(`/subscribers/status/pending-reconnect`),
  markDisconnect: (ids) => request(`/subscribers/mark-disconnect`, { method: "POST", body: JSON.stringify({ ids }) }),
  confirmDisconnect: (id) => request(`/subscribers/${id}/confirm-disconnect`, { method: "PUT" }),
  sendToReconnect: (id) => request(`/subscribers/${id}/send-to-reconnect`, { method: "PUT" }),
  reconnect: (id) => request(`/subscribers/${id}/reconnect`, { method: "PUT" }),
  addReading: (id, data) => request(`/subscribers/${id}/reading`, { method: "POST", body: JSON.stringify(data) }),
  submitStocktakeRequest: (items) => request(`/subscribers/stocktake/request`, { method: "POST", body: JSON.stringify({ items }) }),
  downloadStocktakeTemplate: async () => {
    const token = localStorage.getItem("fatura_token");
    const res = await fetch(`${API_BASE}/subscribers/stocktake/template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      if (res.status === 401) clearSessionOnUnauthorized();
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || "فشل تنزيل قالب الجرد");
    }
    return res.blob();
  },
  importStocktakeExcel: async (file) => {
    const form = new FormData();
    form.append("file", file);
    const token = localStorage.getItem("fatura_token");
    const res = await fetch(`${API_BASE}/subscribers/stocktake/import`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      if (res.status === 401) clearSessionOnUnauthorized();
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || "فشل قراءة ملف الجرد");
    }
    return res.json();
  },
  getStocktakeRequests: () => request(`/subscribers/stocktake/requests`),
  approveStocktake: async (id) => {
    const token = localStorage.getItem("fatura_token");
    const res = await fetch(`${API_BASE}/subscribers/stocktake/requests/${id}/approve`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      if (res.status === 401) clearSessionOnUnauthorized();
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "حدث خطأ في اعتماد الجرد");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fatura-before-stocktake-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return true;
  },
  sendSmsBulk: (data) => request(`/subscribers/send-reminder`, { method: "POST", body: JSON.stringify(data) }),
  getCycle: (id) => request(`/cycles/${id}`),
  pay: (id, amount) => request(`/cycles/${id}/pay`, { method: "POST", body: JSON.stringify({ amount }) }),
  getDashboard: () => request(`/dashboard/summary`),
  exportDashboardExcel: async () => {
    const token = localStorage.getItem("fatura_token");
    const res = await fetch(`${API_BASE}/dashboard/export-excel`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      if (res.status === 401) clearSessionOnUnauthorized();
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "فشل إنشاء تقرير Excel");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fatura-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
  getOverdueReports: () => request(`/reports/overdue`),
  getMonthlyReports: () => request(`/reports/monthly`),
  getFinanceSummary: () => request(`/finance/summary`),
  addCashOut: (amount, reason) => request(`/finance/cash-out`, { method: "POST", body: JSON.stringify({ amount, reason }) }),
  closeFinanceDay: () => request(`/finance/close-day`, { method: "POST" }),
  getDailyPaid: () => request(`/finance/daily-paid`),
  getSmsLogs: () => request(`/sms/logs`),
  sendSms: (data) => request(`/sms/send`, { method: "POST", body: JSON.stringify(data) }),
  importExcel: async (file) => {
    const form = new FormData();
    form.append("file", file);
    const token = localStorage.getItem("fatura_token");
    const res = await fetch(`${API_BASE}/import/excel`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
    if (res.status === 401) {
      clearSessionOnUnauthorized();
    }
    if (!res.ok) throw new Error("فشل الاستيراد");
    return res.json();
  },
};
