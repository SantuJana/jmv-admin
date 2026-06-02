"use client";

import { AdminShell } from "@/components/admin/admin-shell";
import { InventoryManager } from "@/components/admin/inventory-manager";

export default function InventoryPage() {
  return (
    <AdminShell>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Inventory</h2>
        <p className="text-sm text-muted-foreground">Track low-stock variants and adjust inventory quickly.</p>
      </div>

      <InventoryManager />
    </AdminShell>
  );
}
