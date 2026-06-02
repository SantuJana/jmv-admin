"use client";

import { useQuery } from "@tanstack/react-query";
import { Boxes, FolderTree, Package, ShoppingBag, Users } from "lucide-react";
import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";

type PaginationMeta = {
  total: number;
};

type OrderSummary = {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  createdAt: string;
  user: {
    name: string;
  };
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

export default function AdminHomePage() {
  const { authorizedRequest, token } = useAuth();

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [orders, products, users, inventory] = await Promise.all([
        authorizedRequest<ApiResponse<{ orders: OrderSummary[] }, PaginationMeta>>("/orders/manage?limit=5"),
        authorizedRequest<ApiResponse<{ products: unknown[] }, PaginationMeta>>("/products/manage?limit=1"),
        authorizedRequest<ApiResponse<{ users: unknown[] }, PaginationMeta>>("/users/manage?limit=1"),
        authorizedRequest<ApiResponse<{ variants: unknown[] }>>("/inventory/low-stock?threshold=10")
      ]);

      return {
        recentOrders: orders.data.orders,
        stats: [
          {
            label: "Orders",
            value: String(orders.meta?.total ?? 0),
            icon: ShoppingBag
          },
          {
            label: "Products",
            value: String(products.meta?.total ?? 0),
            icon: Package
          },
          {
            label: "Users",
            value: String(users.meta?.total ?? 0),
            icon: Users
          },
          {
            label: "Inventory Alerts",
            value: String(inventory.data.variants.length),
            icon: Boxes
          }
        ]
      };
    },
    enabled: Boolean(token)
  });

  const stats = dashboardQuery.data?.stats ?? [
    { label: "Orders", value: "-", icon: ShoppingBag },
    { label: "Products", value: "-", icon: Package },
    { label: "Users", value: "-", icon: Users },
    { label: "Inventory Alerts", value: "-", icon: Boxes }
  ];

  return (
    <AdminShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Manage catalog setup and grocery operations.</p>
        </div>
        <Button asChild>
          <Link href="/categories">
            <FolderTree className="mr-2 size-4" />
            Manage Categories
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-card p-4 text-card-foreground">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <stat.icon className="size-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-base font-semibold">Recent Orders</h2>
          {dashboardQuery.isLoading ? (
            <div className="mt-4 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Loading orders...
            </div>
          ) : dashboardQuery.isError ? (
            <div className="mt-4 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Could not load dashboard data.
            </div>
          ) : !dashboardQuery.data || dashboardQuery.data.recentOrders.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No orders yet.
            </div>
          ) : (
            <div className="mt-4 divide-y rounded-md border">
              {dashboardQuery.data.recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{order.orderNumber}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {order.user.name} · {order.status} · {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <p className="font-semibold">Rs. {order.total}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-base font-semibold">Operations</h2>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>Review low-stock alerts before accepting large orders.</p>
            <p>Blocked users cannot log in until reactivated from Users.</p>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
