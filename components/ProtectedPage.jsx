"use client";

import { useRole } from "@/hooks/useRole";

export default function ProtectedPage({ allowedRoles, children }) {
  const role = useRole();

  if (!role) return <div>Loading...</div>;

  if (!allowedRoles.includes(role)) {
    return <div className="p-6">Unauthorized</div>;
  }

  return children;
}