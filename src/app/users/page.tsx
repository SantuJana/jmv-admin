"use client";

import { AdminShell } from "@/components/admin/admin-shell";
import { UserManager } from "@/components/admin/user-manager";

export default function UsersPage() {
  return (
    <AdminShell>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Users</h2>
        <p className="text-sm text-muted-foreground">Review customers and block or unblock access.</p>
      </div>

      <UserManager />
    </AdminShell>
  );
}
