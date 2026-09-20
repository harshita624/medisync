"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useAuthStore from "@/store/authStore";
import { getMe } from "@/lib/api";
import Cookies from "js-cookie";

const roleRedirect = {
  patient:   "/patient/dashboard",
  doctor:    "/doctor/dashboard",
  insurance: "/insurance/dashboard",
  admin:     "/admin/dashboard",
};

function AuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

useEffect(() => {
  const token = params.get("token");
  const error = params.get("error");

  if (error || !token) {
    router.push("/login?error=oauth_failed");
    return;
  }

  // Save token BEFORE calling getMe so the interceptor picks it up
  Cookies.set("token", token, { expires: 7 });
  localStorage.setItem("token", token);

  getMe()
    .then((res) => {
      // FIX: this used to be a bare `res.data.data.user`. The documented
      // backend shape for GET /auth/me is { success, data: { user } }, so
      // that path is correct — but it had zero guard, so any shape drift
      // threw a raw "Cannot read properties of undefined" TypeError
      // instead of failing cleanly. Optional-chain through every level,
      // fall back to a one-level-shallower shape just in case, and log
      // the raw payload before giving up so a future failure is visible
      // in the console immediately instead of needing another round trip.
      const user = res.data?.data?.user ?? res.data?.user;

      if (!user) {
        console.error("[GOOGLE CALLBACK] Unexpected getMe response shape:", res.data);
        throw new Error("Could not load user profile");
      }

      setAuth(user, token);
      const destination = roleRedirect[user.role];
      if (!destination) {
        router.push("/");
        return;
      }
      router.push(destination);
    })
    .catch((err) => {
      console.error("getMe failed:", err);
      router.push("/login?error=oauth_failed");
    });
}, [params, router, setAuth]);

  return (
    <div className="min-h-screen hero-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 font-medium">Signing you in...</p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen hero-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Signing you in...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}