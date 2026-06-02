"use client";

import { AdminShell } from "@/components/admin/admin-shell";
import { CategoryManager } from "@/components/admin/category-manager";

export default function CategoriesPage() {
  return (
    <AdminShell>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Categories</h2>
        <p className="text-sm text-muted-foreground">Create and maintain grocery catalog categories.</p>
      </div>

      <CategoryManager />
    </AdminShell>
  );
}
