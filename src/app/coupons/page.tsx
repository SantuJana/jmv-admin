"use client";

import { AdminShell } from "@/components/admin/admin-shell";
import { CouponManager } from "@/components/admin/coupon-manager";

export default function CouponsPage() {
  return (
    <AdminShell>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Coupons</h2>
        <p className="text-sm text-muted-foreground">Create and schedule cart discounts for customers.</p>
      </div>

      <CouponManager />
    </AdminShell>
  );
}
