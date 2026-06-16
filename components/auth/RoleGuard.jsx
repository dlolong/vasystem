"use client";

import { useAuthUser } from "@/lib/hooks/useAuthUser";

export default function RoleGuard({ role, children }) {
  const { profile, loading } = useAuthUser();

  if (loading) return <div className="p-6">Loading...</div>;

  if (profile?.role !== role) {
    return (
      <div className="p-6 text-red-500">
        Access denied
      </div>
    );
  }

  return children;
}