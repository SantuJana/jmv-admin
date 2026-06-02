"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

type OrderStatus = "PENDING" | "CONFIRMED" | "PACKED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: "COD" | "RAZORPAY";
  paymentStatus: PaymentStatus;
  subtotal: string;
  deliveryFee: string;
  discountAmount: string;
  couponCode: string | null;
  total: string;
  notes: string | null;
  createdAt: string;
  user: {
    name: string;
    email: string;
    phone: string | null;
  };
  address: {
    fullName: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  } | null;
  items: Array<{
    id: string;
    productName: string;
    variantName: string;
    sku: string;
    unit: string;
    quantity: number;
    unitPrice: string;
    total: string;
  }>;
};

const orderStatuses: OrderStatus[] = ["PENDING", "CONFIRMED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];
const paymentStatuses: PaymentStatus[] = ["PENDING", "PAID", "FAILED", "REFUNDED"];

const formatStatus = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

export function OrderManager() {
  const queryClient = useQueryClient();
  const { authorizedRequest, token } = useAuth();
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<OrderStatus>("PENDING");
  const [draftPaymentStatus, setDraftPaymentStatus] = useState<PaymentStatus>("PENDING");
  const [error, setError] = useState<string | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["orders", statusFilter],
    queryFn: async () => {
      const query = new URLSearchParams({ limit: "100" });

      if (statusFilter) {
        query.set("status", statusFilter);
      }

      const response = await authorizedRequest<ApiResponse<{ orders: Order[] }>>(
        `/orders/manage?${query.toString()}`
      );

      return response.data.orders;
    },
    enabled: Boolean(token)
  });

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? orders[0] ?? null;

  const updateMutation = useMutation({
    mutationFn: (order: { id: string; status: OrderStatus; paymentStatus: PaymentStatus }) =>
      authorizedRequest(`/orders/manage/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: order.status,
          paymentStatus: order.paymentStatus
        })
      }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Order could not be updated");
    }
  });

  const selectOrder = (order: Order) => {
    setSelectedOrderId(order.id);
    setDraftStatus(order.status);
    setDraftPaymentStatus(order.paymentStatus);
    setError(null);
  };

  const activeOrder = selectedOrder;

  return (
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <section className="rounded-lg border bg-card">
        <div className="space-y-3 border-b p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Orders</h2>
              <p className="text-sm text-muted-foreground">{orders.length} records</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => void ordersQuery.refetch()}
              disabled={ordersQuery.isFetching}
            >
              {ordersQuery.isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            </Button>
          </div>

          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            {orderStatuses.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>
        </div>

        <div className="divide-y">
          {ordersQuery.isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No orders found.</div>
          ) : (
            orders.map((order) => (
              <button
                key={order.id}
                className={cn(
                  "block w-full px-4 py-3 text-left hover:bg-muted/70",
                  activeOrder?.id === order.id && "bg-muted"
                )}
                type="button"
                onClick={() => selectOrder(order)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{order.orderNumber}</p>
                    <p className="truncate text-xs text-muted-foreground">{order.user.name}</p>
                  </div>
                  <p className="text-sm font-semibold">Rs. {order.total}</p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-background px-2 py-1">{formatStatus(order.status)}</span>
                  <span>{formatDate(order.createdAt)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-card">
        {!activeOrder ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Select an order to view details.</div>
        ) : (
          <div>
            <div className="border-b p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">{activeOrder.orderNumber}</h2>
                  <p className="text-sm text-muted-foreground">{formatDate(activeOrder.createdAt)}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-lg font-semibold">Rs. {activeOrder.total}</p>
                  <p className="text-xs text-muted-foreground">{activeOrder.paymentMethod}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">Customer</h3>
                <div className="mt-2 text-sm text-muted-foreground">
                  <p className="text-foreground">{activeOrder.user.name}</p>
                  <p>{activeOrder.user.email}</p>
                  <p>{activeOrder.user.phone ?? "No phone"}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Delivery Address</h3>
                <div className="mt-2 text-sm text-muted-foreground">
                  {activeOrder.address ? (
                    <>
                      <p className="text-foreground">{activeOrder.address.fullName}</p>
                      <p>{activeOrder.address.phone}</p>
                      <p>
                        {activeOrder.address.line1}
                        {activeOrder.address.line2 ? `, ${activeOrder.address.line2}` : ""}
                      </p>
                      <p>
                        {activeOrder.address.city}, {activeOrder.address.state} {activeOrder.address.postalCode}
                      </p>
                    </>
                  ) : (
                    <p>Address removed</p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t p-5">
              <h3 className="text-sm font-semibold">Items</h3>
              <div className="mt-3 divide-y rounded-md border">
                {activeOrder.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.productName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.variantName} · {item.sku} · qty {item.quantity}
                      </p>
                    </div>
                    <p className="font-medium">Rs. {item.total}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t p-5">
              <h3 className="text-sm font-semibold">Summary</h3>
              <div className="mt-3 space-y-2 rounded-md border p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>Rs. {activeOrder.subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery</span>
                  <span>Rs. {activeOrder.deliveryFee}</span>
                </div>
                {Number(activeOrder.discountAmount) > 0 ? (
                  <div className="flex justify-between text-emerald-700">
                    <span>Coupon {activeOrder.couponCode}</span>
                    <span>-Rs. {activeOrder.discountAmount}</span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Total</span>
                  <span>Rs. {activeOrder.total}</span>
                </div>
              </div>
            </div>

            <div className="border-t p-5">
              <h3 className="text-sm font-semibold">Update Status</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={draftStatus}
                  onChange={(event) => setDraftStatus(event.target.value as OrderStatus)}
                >
                  {orderStatuses.map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>

                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={draftPaymentStatus}
                  onChange={(event) => setDraftPaymentStatus(event.target.value as PaymentStatus)}
                >
                  {paymentStatuses.map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>

                <Button
                  className="gap-2"
                  disabled={updateMutation.isPending}
                  onClick={() =>
                    updateMutation.mutate({
                      id: activeOrder.id,
                      status: draftStatus,
                      paymentStatus: draftPaymentStatus
                    })
                  }
                >
                  {updateMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Save
                </Button>
              </div>

              {error ? <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
