import { createContext, useContext, useMemo, useState } from "react";
import { api } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("fatura_token"));
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("fatura_user")) || null;
    } catch {
      return null;
    }
  });

  const login = async (credentials) => {
    const data = await api.login(credentials);
    localStorage.setItem("fatura_token", data.token);
    localStorage.setItem("fatura_user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("fatura_token");
    localStorage.removeItem("fatura_user");
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ token, user, login, logout }), [token, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}