"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";

type DiscountType = "PERCENTAGE" | "FIXED";

type Coupon = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: string;
  minOrderAmount: string;
  maxDiscountAmount: string | null;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

type CouponFormState = {
  id?: string;
  code: string;
  title: string;
  description: string;
  discountType: DiscountType;
  discountValue: string;
  minOrderAmount: string;
  maxDiscountAmount: string;
  usageLimit: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

const emptyForm: CouponFormState = {
  code: "",
  title: "",
  description: "",
  discountType: "PERCENTAGE",
  discountValue: "",
  minOrderAmount: "0",
  maxDiscountAmount: "",
  usageLimit: "",
  isActive: true,
  startsAt: "",
  endsAt: ""
};

const toCode = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toDateTimeLocal = (value: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return offsetDate.toISOString().slice(0, 16);
};

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString() : "Any time");

export function CouponManager() {
  const queryClient = useQueryClient();
  const { authorizedRequest, token } = useAuth();
  const [form, setForm] = useState<CouponFormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const couponsQuery = useQuery({
    queryKey: ["coupons"],
    queryFn: async () => {
      const response = await authorizedRequest<ApiResponse<{ coupons: Coupon[] }>>("/coupons/manage?limit=100");

      return response.data.coupons;
    },
    enabled: Boolean(token)
  });

  const coupons = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...(couponsQuery.data ?? [])]
      .filter((coupon) => {
        if (!normalizedSearch) {
          return true;
        }

        return (
          coupon.code.toLowerCase().includes(normalizedSearch) ||
          coupon.title.toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [couponsQuery.data, search]);

  const saveCouponMutation = useMutation({
    mutationFn: (payload: CouponFormState) => {
      const body = JSON.stringify({
        code: toCode(payload.code),
        title: payload.title,
        description: payload.description || undefined,
        discountType: payload.discountType,
        discountValue: payload.discountValue,
        minOrderAmount: payload.minOrderAmount || "0",
        maxDiscountAmount: payload.maxDiscountAmount || undefined,
        usageLimit: payload.usageLimit ? Number(payload.usageLimit) : undefined,
        isActive: payload.isActive,
        startsAt: payload.startsAt ? new Date(payload.startsAt).toISOString() : undefined,
        endsAt: payload.endsAt ? new Date(payload.endsAt).toISOString() : undefined
      });

      if (payload.id) {
        return authorizedRequest(`/coupons/manage/${payload.id}`, {
          method: "PATCH",
          body
        });
      }

      return authorizedRequest("/coupons/manage", {
        method: "POST",
        body
      });
    },
    onSuccess: async () => {
      resetForm();
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["coupons"] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Coupon could not be saved");
    }
  });

  const deleteCouponMutation = useMutation({
    mutationFn: (couponId: string) =>
      authorizedRequest(`/coupons/manage/${couponId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ["coupons"] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Coupon could not be deleted");
    }
  });

  function resetForm() {
    setForm(emptyForm);
  }

  const startEdit = (coupon: Coupon) => {
    setError(null);
    setForm({
      id: coupon.id,
      code: coupon.code,
      title: coupon.title,
      description: coupon.description ?? "",
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderAmount: coupon.minOrderAmount,
      maxDiscountAmount: coupon.maxDiscountAmount ?? "",
      usageLimit: coupon.usageLimit === null ? "" : String(coupon.usageLimit),
      isActive: coupon.isActive,
      startsAt: toDateTimeLocal(coupon.startsAt),
      endsAt: toDateTimeLocal(coupon.endsAt)
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    saveCouponMutation.mutate(form);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
      <form className="rounded-lg border bg-card p-5 lg:sticky lg:top-24 lg:self-start" onSubmit={handleSubmit}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{form.id ? "Edit Coupon" : "New Coupon"}</h2>
            <p className="text-sm text-muted-foreground">Set discount rules and campaign timing.</p>
          </div>
          {form.id ? (
            <Button type="button" variant="ghost" size="icon" onClick={resetForm}>
              <X className="size-4" />
            </Button>
          ) : null}
        </div>

        {error ? <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Code</span>
            <input
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm uppercase outline-none focus:ring-2 focus:ring-ring"
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: toCode(event.target.value) }))}
              placeholder="SAVE20"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Title</span>
            <input
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="20% off groceries"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Description</span>
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Discount type</span>
              <select
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={form.discountType}
                onChange={(event) =>
                  setForm((current) => ({ ...current, discountType: event.target.value as DiscountType }))
                }
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED">Fixed amount</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium">Discount value</span>
              <input
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={form.discountValue}
                onChange={(event) => setForm((current) => ({ ...current, discountValue: event.target.value }))}
                placeholder={form.discountType === "PERCENTAGE" ? "20" : "50"}
                required
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium">Min order</span>
              <input
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={form.minOrderAmount}
                onChange={(event) => setForm((current) => ({ ...current, minOrderAmount: event.target.value }))}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Max discount</span>
              <input
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={form.maxDiscountAmount}
                onChange={(event) => setForm((current) => ({ ...current, maxDiscountAmount: event.target.value }))}
                placeholder="Optional"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Usage limit</span>
              <input
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                min="1"
                type="number"
                value={form.usageLimit}
                onChange={(event) => setForm((current) => ({ ...current, usageLimit: event.target.value }))}
                placeholder="Optional"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Starts at</span>
              <input
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Ends at</span>
              <input
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            Active
          </label>

          <Button className="w-full gap-2" type="submit" disabled={saveCouponMutation.isPending}>
            {saveCouponMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {form.id ? "Save Coupon" : "Create Coupon"}
          </Button>
        </div>
      </form>

      <section className="rounded-lg border bg-card">
        <div className="space-y-3 border-b p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Coupons</h2>
              <p className="text-sm text-muted-foreground">{coupons.length} discount rules</p>
            </div>
            {couponsQuery.isFetching ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          </div>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search coupons"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="divide-y">
          {couponsQuery.isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading coupons...</div>
          ) : coupons.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No coupons found.</div>
          ) : (
            coupons.map((coupon) => (
              <div key={coupon.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-semibold">{coupon.code}</p>
                    <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {coupon.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium">{coupon.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {coupon.discountType === "PERCENTAGE" ? `${coupon.discountValue}%` : `Rs. ${coupon.discountValue}`} off
                    {Number(coupon.minOrderAmount) > 0 ? ` · min Rs. ${coupon.minOrderAmount}` : ""}
                    {coupon.maxDiscountAmount ? ` · cap Rs. ${coupon.maxDiscountAmount}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Used {coupon.usageCount}
                    {coupon.usageLimit ? `/${coupon.usageLimit}` : ""} · {formatDate(coupon.startsAt)} to {formatDate(coupon.endsAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="icon" onClick={() => startEdit(coupon)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={deleteCouponMutation.isPending}
                    onClick={() => deleteCouponMutation.mutate(coupon.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
