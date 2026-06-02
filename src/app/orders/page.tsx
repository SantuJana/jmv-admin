"use client";

import { AdminShell } from "@/components/admin/admin-shell";
import { OrderManager } from "@/components/admin/order-manager";

export default function OrdersPage() {
  return (
    <AdminShell>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Orders</h2>
        <p className="text-sm text-muted-foreground">Review orders and update fulfillment status.</p>
      </div>

      <OrderManager />
    </AdminShell>
  );
}
