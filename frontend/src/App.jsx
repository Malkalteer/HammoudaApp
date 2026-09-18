import { useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import Subscribers from "./pages/Subscribers.jsx";
import SubscriberDetail from "./pages/SubscriberDetail.jsx";
import Print from "./pages/Print.jsx";
import Import from "./pages/Import.jsx";
import CutList from "./pages/CutList.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Reports from "./pages/Reports.jsx";
import SmsPanel from "./pages/SmsPanel.jsx";
import Auth from "./pages/Auth.jsx";
import Stocktake from "./pages/Stocktake.jsx";
import Finance from "./pages/Finance.jsx";
import AdminStocktake from "./pages/AdminStocktake.jsx";
import Settings from "./pages/Settings.jsx";
import Users from "./pages/Users.jsx";

const roles = {
  all: ["admin", "accountant", "electrician"],
  adminAccountant: ["admin", "accountant"],
  adminElectrician: ["admin", "electrician"],
  cutList: ["admin", "accountant", "electrician"],
  adminOnly: ["admin"],
};

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const closeMenu = () => setMenuOpen(false);

  return (
    <div>
      <nav className="nav">
        <div className="nav-inner">
          <NavLink to="/" end className="brand" onClick={closeMenu}>
            <span className="brand-mark">H</span>
            <span>Hamuodah</span>
          </NavLink>
          <button
            type="button"
            className="menu-toggle"
            aria-label="فتح القائمة"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <div className={`nav-links${menuOpen ? " is-open" : ""}`}>
            {user && <>
              {roles.adminAccountant.includes(user.role) && <NavLink to="/" end onClick={closeMenu}>المشتركون</NavLink>}
              {roles.adminAccountant.includes(user.role) && <NavLink to="/dashboard" onClick={closeMenu}>لوحة التحكم</NavLink>}
              {roles.adminElectrician.includes(user.role) && <NavLink to="/stocktake" onClick={closeMenu}>صفحة الجرد</NavLink>}
              {user.role === "admin" && <NavLink to="/admin/stocktake" onClick={closeMenu}>موافقة الجرد</NavLink>}
              {roles.cutList.includes(user.role) && <NavLink to="/cut-list" onClick={closeMenu}>صفحة القطع</NavLink>}
              {roles.adminAccountant.includes(user.role) && <NavLink to="/reports" onClick={closeMenu}>التقارير</NavLink>}
              {roles.adminAccountant.includes(user.role) && <NavLink to="/finance" onClick={closeMenu}>المالية</NavLink>}
              {roles.adminAccountant.includes(user.role) && <NavLink to="/sms" onClick={closeMenu}>SMS</NavLink>}
              {roles.adminAccountant.includes(user.role) && <NavLink to="/settings" onClick={closeMenu}>الإعدادات</NavLink>}
              {user.role === "admin" && <NavLink to="/import" onClick={closeMenu}>استيراد Excel</NavLink>}
              {user.role === "admin" && <NavLink to="/users" onClick={closeMenu}>المستخدمون</NavLink>}
              <span className="nav-user-name" title={user.name}>مرحبًا، {user.name}</span>
              <button type="button" onClick={() => { logout(); closeMenu(); }}>خروج</button>
            </>}
            {!user && <NavLink to="/auth" onClick={closeMenu}>تسجيل الدخول</NavLink>}
          </div>
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<ProtectedRoute allowedRoles={roles.adminAccountant}><Subscribers /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={roles.adminAccountant}><Dashboard /></ProtectedRoute>} />
        <Route path="/stocktake" element={<ProtectedRoute allowedRoles={roles.adminElectrician}><Stocktake /></ProtectedRoute>} />
        <Route path="/admin/stocktake" element={<ProtectedRoute allowedRoles={roles.adminElectrician}><AdminStocktake /></ProtectedRoute>} />
        <Route path="/subscriber/:id" element={<ProtectedRoute allowedRoles={roles.adminAccountant}><SubscriberDetail /></ProtectedRoute>} />
        <Route path="/print/:cycleId" element={<ProtectedRoute allowedRoles={roles.adminAccountant}><Print /></ProtectedRoute>} />
        <Route path="/import" element={<ProtectedRoute allowedRoles={roles.adminOnly}><Import /></ProtectedRoute>} />
        <Route path="/cut-list" element={<ProtectedRoute allowedRoles={roles.cutList}><CutList /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute allowedRoles={roles.adminAccountant}><Reports /></ProtectedRoute>} />
        <Route path="/finance" element={<ProtectedRoute allowedRoles={roles.adminAccountant}><Finance /></ProtectedRoute>} />
        <Route path="/sms" element={<ProtectedRoute allowedRoles={roles.adminAccountant}><SmsPanel /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute allowedRoles={roles.adminAccountant}><Settings /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute allowedRoles={roles.adminOnly}><Users /></ProtectedRoute>} />
        <Route path="/auth" element={<Auth />} /> 
      </Routes>
    </div>
  );
}
