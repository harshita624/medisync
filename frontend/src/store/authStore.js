"use client";
import { create } from "zustand";
import Cookies from "js-cookie";

const useAuthStore = create((set) => ({
  user: null,
  token: null,
  loading: true,

  setAuth: (user, token) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      Cookies.set("token", token, { expires: 7 });
      Cookies.set("user", JSON.stringify(user), { expires: 7 });
    }
    set({ user, token, loading: false });
  },

  setUser: (user) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("user", JSON.stringify(user));
      Cookies.set("user", JSON.stringify(user), { expires: 7 });
    }
    set({ user });
  },

  hydrate: () => {
    if (typeof window === "undefined") return;
    const token = Cookies.get("token") || localStorage.getItem("token");
    const rawUser = Cookies.get("user") || localStorage.getItem("user");
    let user = null;
    try {
      user = rawUser ? JSON.parse(rawUser) : null;
    } catch {}
    set({ user, token, loading: false });
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.clear();
      Cookies.remove("token");
      Cookies.remove("user");
    }
    set({ user: null, token: null, loading: false });
  },

  setLoading: (loading) => set({ loading }),
}));

export default useAuthStore;