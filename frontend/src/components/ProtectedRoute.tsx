import React from "react";
import { useAuth } from "@/context/AuthContext";
import { canAccess, type PageKey } from "@/lib/crm";
import { Navigate } from "react-router-dom";

export function ProtectedRoute({ children, page }: { children: React.ReactNode; page?: PageKey }) {
  const { user, roles, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Authenticating…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (page && !canAccess(roles, page)) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
