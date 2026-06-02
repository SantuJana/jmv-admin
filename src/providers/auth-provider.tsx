"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { ApiError, apiClient, type ApiClientOptions, type ApiResponse } from "@/lib/api-client";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "CUSTOMER";
  status: "ACTIVE" | "BLOCKED";
};

type LoginResponse = ApiResponse<{
  user: AdminUser;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}>;
type RefreshResponse = ApiResponse<{
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}>;

type AuthorizedRequest = <TResponse>(path: string, options?: ApiClientOptions) => Promise<TResponse>;

type AuthContextValue = {
  user: AdminUser | null;
  token: string | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearSession: () => void;
  authorizedRequest: AuthorizedRequest;
};

const AUTH_STORAGE_KEY = "jmv-admin-auth";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type StoredAuth = {
  user: AdminUser;
  token: string;
  refreshToken: string;
};

const readStoredAuth = () => {
  const storedValue = window.localStorage.getItem(AUTH_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    return JSON.parse(storedValue) as StoredAuth;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const authRef = useRef<StoredAuth | null>(null);
  const refreshRequestRef = useRef<Promise<StoredAuth> | null>(null);

  const persistAuth = useCallback((nextAuth: StoredAuth | null) => {
    authRef.current = nextAuth;

    if (nextAuth) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
      setUser(nextAuth.user);
      setToken(nextAuth.token);
      setRefreshToken(nextAuth.refreshToken);
      return;
    }

    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
    setToken(null);
    setRefreshToken(null);
  }, []);

  useEffect(() => {
    const storedAuth = readStoredAuth();

    if (storedAuth) {
      persistAuth(storedAuth);
    }

    setIsReady(true);
  }, [persistAuth]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiClient<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      if (response.data.user.role !== "ADMIN") {
        throw new Error("Only admin users can access the portal");
      }

      const nextAuth = {
        user: response.data.user,
        token: response.data.tokens.accessToken,
        refreshToken: response.data.tokens.refreshToken
      };

      persistAuth(nextAuth);
      router.replace("/");
    },
    [persistAuth, router]
  );

  const clearSession = useCallback(() => {
    persistAuth(null);
    router.replace("/login");
  }, [persistAuth, router]);

  const refreshSession = useCallback(async () => {
    if (!authRef.current?.refreshToken) {
      throw new Error("Session has expired");
    }

    if (!refreshRequestRef.current) {
      refreshRequestRef.current = (async () => {
        const currentAuth = authRef.current;

        if (!currentAuth?.refreshToken) {
          throw new Error("Session has expired");
        }

        const refreshResponse = await apiClient<RefreshResponse>("/auth/refresh", {
          method: "POST",
          body: JSON.stringify({ refreshToken: currentAuth.refreshToken })
        });

        const nextAuth: StoredAuth = {
          ...currentAuth,
          token: refreshResponse.data.tokens.accessToken,
          refreshToken: refreshResponse.data.tokens.refreshToken
        };

        persistAuth(nextAuth);

        return nextAuth;
      })().finally(() => {
        refreshRequestRef.current = null;
      });
    }

    return refreshRequestRef.current;
  }, [persistAuth]);

  const authorizedRequest = useCallback<AuthorizedRequest>(
    async (path, options = {}) => {
      const currentAuth = authRef.current;

      if (!currentAuth?.token) {
        throw new Error("Authentication is required");
      }

      try {
        return await apiClient(path, {
          ...options,
          token: currentAuth.token
        });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401 || !currentAuth.refreshToken) {
          throw error;
        }

        const latestAuth = authRef.current;

        if (latestAuth?.token && latestAuth.token !== currentAuth.token) {
          return apiClient(path, {
            ...options,
            token: latestAuth.token
          });
        }

        try {
          const refreshedAuth = await refreshSession();

          return apiClient(path, {
            ...options,
            token: refreshedAuth.token
          });
        } catch (refreshError) {
          persistAuth(null);
          throw refreshError;
        }
      }
    },
    [persistAuth, refreshSession]
  );

  const logout = useCallback(async () => {
    const tokenToRevoke = refreshToken;

    if (tokenToRevoke) {
      await apiClient("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: tokenToRevoke }),
        token: token ?? undefined
      }).catch(() => {
        // Local logout should still complete if the session is already invalid server-side.
      });
    }

    clearSession();
  }, [clearSession, refreshToken, token]);

  const value = useMemo(
    () => ({
      user,
      token,
      isReady,
      login,
      logout,
      clearSession,
      authorizedRequest
    }),
    [authorizedRequest, clearSession, isReady, login, logout, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

export function isUnauthorizedError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}
