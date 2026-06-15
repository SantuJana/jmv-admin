import { AdminShell } from "@/components/admin/admin-shell";
import { ProductManager } from "@/components/admin/product-manager";

export default function ProductVariantsPage() {
  return (
    <AdminShell>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Product Variants</h2>
        <p className="text-sm text-muted-foreground">Manage pack sizes, prices, stock, and variant images.</p>
      </div>

      <ProductManager view="variants" />
    </AdminShell>
  );
}
