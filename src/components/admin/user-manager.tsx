"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "ADMIN" | "CUSTOMER";
  status: "ACTIVE" | "BLOCKED";
  ordersCount: number;
  addressesCount: number;
  createdAt: string;
};

type ManagedUserDetails = ManagedUser & {
  addresses: Array<{
    id: string;
    type: "HOME" | "WORK" | "OTHER";
    fullName: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    isDefault: boolean;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    total: string;
    itemsCount: number;
    createdAt: string;
  }>;
};

export function UserManager() {
  const queryClient = useQueryClient();
  const { authorizedRequest, token, user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["users", statusFilter],
    queryFn: async () => {
      const query = new URLSearchParams({ limit: "100" });

      if (statusFilter) {
        query.set("status", statusFilter);
      }

      const response = await authorizedRequest<ApiResponse<{ users: ManagedUser[] }>>(
        `/users/manage?${query.toString()}`
      );

      return response.data.users;
    },
    enabled: Boolean(token)
  });

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return (usersQuery.data ?? []).filter((user) => {
      if (!normalizedSearch) {
        return true;
      }

      return (
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch) ||
        (user.phone ?? "").toLowerCase().includes(normalizedSearch)
      );
    });
  }, [search, usersQuery.data]);

  const statusMutation = useMutation({
    mutationFn: (input: { userId: string; status: ManagedUser["status"] }) =>
      authorizedRequest(`/users/manage/${input.userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: input.status })
      }),
    onSuccess: async () => {
      setError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["user-details"] })
      ]);
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "User status could not be updated");
    }
  });

  const selectedUser = filteredUsers.find((user) => user.id === selectedUserId) ?? filteredUsers[0] ?? null;

  const userDetailsQuery = useQuery({
    queryKey: ["user-details", selectedUser?.id],
    queryFn: async () => {
      const response = await authorizedRequest<ApiResponse<{ user: ManagedUserDetails }>>(
        `/users/manage/${selectedUser?.id}`
      );

      return response.data.user;
    },
    enabled: Boolean(token && selectedUser?.id)
  });

  const usersError = usersQuery.error instanceof Error ? usersQuery.error.message : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-lg border bg-card">
        <div className="space-y-3 border-b p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Users</h2>
              <p className="text-sm text-muted-foreground">{filteredUsers.length} accounts</p>
            </div>
            {usersQuery.isFetching ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search name, email, phone"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>

          {error || usersError ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error ?? usersError}
            </p>
          ) : null}
        </div>

        <div className="divide-y">
          {usersQuery.isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading users...</div>
          ) : usersQuery.isError ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Could not load users. Check that the backend is running and your admin session is fresh.
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No users found.</div>
          ) : (
            filteredUsers.map((user) => (
              <button
                key={user.id}
                className="block w-full p-4 text-left hover:bg-muted/70"
                type="button"
                onClick={() => setSelectedUserId(user.id)}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email} · {user.phone ?? "No phone"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {user.role} · {user.ordersCount} orders · {user.addressesCount} addresses
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{user.status}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-card">
        {!selectedUser ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Select a user to view details.</div>
        ) : userDetailsQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading user details...</div>
        ) : userDetailsQuery.isError || !userDetailsQuery.data ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Could not load user details.</div>
        ) : (
          <div>
            <div className="border-b p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">{userDetailsQuery.data.name}</h2>
                  <p className="text-sm text-muted-foreground">{userDetailsQuery.data.email}</p>
                  <p className="text-sm text-muted-foreground">{userDetailsQuery.data.phone ?? "No phone"}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={statusMutation.isPending || userDetailsQuery.data.id === currentUser?.id}
                  onClick={() =>
                    statusMutation.mutate({
                      userId: userDetailsQuery.data.id,
                      status: userDetailsQuery.data.status === "ACTIVE" ? "BLOCKED" : "ACTIVE"
                    })
                  }
                >
                  {userDetailsQuery.data.status === "ACTIVE" ? "Block User" : "Unblock User"}
                </Button>
              </div>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">Addresses</h3>
                <div className="mt-3 space-y-3">
                  {userDetailsQuery.data.addresses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No addresses saved.</p>
                  ) : (
                    userDetailsQuery.data.addresses.map((address) => (
                      <div key={address.id} className="rounded-md border p-3 text-sm">
                        <p className="font-medium">
                          {address.fullName} {address.isDefault ? "· Default" : ""}
                        </p>
                        <p className="text-muted-foreground">{address.phone}</p>
                        <p className="text-muted-foreground">
                          {address.line1}
                          {address.line2 ? `, ${address.line2}` : ""}
                        </p>
                        <p className="text-muted-foreground">
                          {address.city}, {address.state} {address.postalCode}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Recent Orders</h3>
                <div className="mt-3 space-y-3">
                  {userDetailsQuery.data.recentOrders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No orders yet.</p>
                  ) : (
                    userDetailsQuery.data.recentOrders.map((order) => (
                      <div key={order.id} className="rounded-md border p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{order.orderNumber}</p>
                          <p>Rs. {order.total}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {order.status} · {order.paymentStatus} · {order.itemsCount} items
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
