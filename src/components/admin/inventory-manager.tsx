"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";

type InventoryVariant = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  unit: string;
  isActive: boolean;
  product: {
    name: string;
    category: {
      name: string;
    };
  };
};

export function InventoryManager() {
  const queryClient = useQueryClient();
  const { authorizedRequest, token } = useAuth();
  const [threshold, setThreshold] = useState("10");
  const [draftStock, setDraftStock] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const inventoryQuery = useQuery({
    queryKey: ["inventory", threshold],
    queryFn: async () => {
      const response = await authorizedRequest<ApiResponse<{ threshold: number; variants: InventoryVariant[] }>>(
        `/inventory/low-stock?threshold=${threshold || "10"}`
      );

      return response.data.variants;
    },
    enabled: Boolean(token)
  });

  const stockMutation = useMutation({
    mutationFn: (input: { variantId: string; stock: number }) =>
      authorizedRequest(`/inventory/variants/${input.variantId}/stock`, {
        method: "PATCH",
        body: JSON.stringify({ stock: input.stock })
      }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Stock could not be updated");
    }
  });

  const variants = inventoryQuery.data ?? [];

  return (
    <section className="rounded-lg border bg-card">
      <div className="space-y-3 border-b p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Low Stock</h2>
            <p className="text-sm text-muted-foreground">{variants.length} variants at or below threshold</p>
          </div>
          {inventoryQuery.isFetching ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
        </div>

        <label className="block max-w-xs">
          <span className="text-sm font-medium">Threshold</span>
          <input
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            min="0"
            type="number"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
          />
        </label>

        {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      </div>

      <div className="divide-y">
        {inventoryQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading inventory...</div>
        ) : variants.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No low-stock variants found.</div>
        ) : (
          variants.map((variant) => {
            const nextStock = draftStock[variant.id] ?? String(variant.stock);

            return (
              <div key={variant.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_180px_auto] lg:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {variant.product.name} · {variant.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {variant.product.category.name} · {variant.sku} · {variant.unit} · current {variant.stock}
                  </p>
                </div>
                <input
                  className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  min="0"
                  type="number"
                  value={nextStock}
                  onChange={(event) =>
                    setDraftStock((current) => ({
                      ...current,
                      [variant.id]: event.target.value
                    }))
                  }
                />
                <Button
                  className="gap-2"
                  disabled={stockMutation.isPending}
                  onClick={() => stockMutation.mutate({ variantId: variant.id, stock: Number(nextStock) })}
                >
                  <Save className="size-4" />
                  Save
                </Button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
