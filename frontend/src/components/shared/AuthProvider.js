"use client";
import { useEffect } from "react";
import useAuthStore from "@/store/authStore";
import { getMe } from "@/lib/api";
import Cookies from "js-cookie";

export default function AuthProvider({ children }) {
  const { setAuth, logout, setLoading } = useAuthStore();

  useEffect(() => {
    const token = Cookies.get("token") || localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    // Restore from cookie instantly
    const cachedUser = Cookies.get("user");
    if (cachedUser) {
      try {
        const parsed = JSON.parse(cachedUser);
        setAuth(parsed, token);
        return; // already set, no need to wait for server
      } catch {
        // bad cookie, continue to server verify
      }
    }

    // Verify with server
    getMe()
      .then((res) => setAuth(res.data.user || res.data.data?.user, token))
      .catch(() => {
        logout();
        setLoading(false);
      });
  }, []);

  return children;
}
