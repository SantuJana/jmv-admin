"use client";

import { AdminShell } from "@/components/admin/admin-shell";
import { BannerManager } from "@/components/admin/banner-manager";

export default function BannersPage() {
  return (
    <AdminShell>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Banners</h2>
        <p className="text-sm text-muted-foreground">Create and schedule promotional banners for the storefront.</p>
      </div>

      <BannerManager />
    </AdminShell>
  );
}
