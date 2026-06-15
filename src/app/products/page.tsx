"use client";

import { AdminShell } from "@/components/admin/admin-shell";
import { ProductManager } from "@/components/admin/product-manager";

export default function ProductsPage() {
  return (
    <AdminShell>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Products</h2>
        <p className="text-sm text-muted-foreground">Create products, upload images, and keep catalog details tidy.</p>
      </div>

      <ProductManager view="products" />
    </AdminShell>
  );
}
