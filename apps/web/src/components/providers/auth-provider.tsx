"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@tr-studio/shared-types";
import {
  api,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from "@/lib/api";
import { neonAuthClient } from "@/lib/neon-auth";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: { email: string; password: string }) => Promise<void>;
  register: (payload: { email: string; username: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);
    } catch {
      clearStoredToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (payload: { email: string; password: string }) => {
      try {
        await neonAuthClient.signIn.email({
          email: payload.email,
          password: payload.password,
          callbackURL:
            typeof window !== "undefined"
              ? window.location.origin
              : "http://localhost:3000",
        });
      } catch (neonErr) {
        console.warn("[Neon Auth] Sign in sync notice:", neonErr);
      }
      const res = await api.auth.login(payload);
      setStoredToken(res.access_token);
      setUser(res.user);
      router.push("/dashboard");
    },
    [router]
  );

  const register = useCallback(
    async (payload: { email: string; username: string; password: string }) => {
      try {
        await neonAuthClient.signUp.email({
          email: payload.email,
          password: payload.password,
          name: payload.username,
          callbackURL:
            typeof window !== "undefined"
              ? window.location.origin
              : "http://localhost:3000",
        });
      } catch (neonErr) {
        console.warn("[Neon Auth] Sign up sync notice:", neonErr);
      }
      const res = await api.auth.register(payload);
      setStoredToken(res.access_token);
      setUser(res.user);
      router.push("/dashboard");
    },
    [router]
  );

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return ctx;
}
