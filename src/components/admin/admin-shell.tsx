"use client";

import { Boxes, FolderTree, Images, LayoutDashboard, LogOut, Package, ShoppingBag, Tags, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

const navItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard
  },
  {
    href: "/categories",
    label: "Categories",
    icon: FolderTree
  },
  {
    href: "/banners",
    label: "Banners",
    icon: Images
  },
  {
    href: "/products",
    label: "Products",
    icon: Package
  },
  {
    href: "/orders",
    label: "Orders",
    icon: ShoppingBag
  },
  {
    href: "/coupons",
    label: "Coupons",
    icon: Tags
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: Boxes
  },
  {
    href: "/users",
    label: "Users",
    icon: Users
  }
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isReady, logout, token, user } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (isReady && !token) {
      router.replace("/login");
    }
  }, [isReady, router, token]);

  if (!isReady || !token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 px-5">
        <div className="text-sm text-muted-foreground">Loading admin portal...</div>
      </main>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-muted/40">
      <div className="flex h-full min-h-0">
        <aside className="hidden h-screen w-64 shrink-0 overflow-y-auto border-r bg-background px-4 py-5 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <img alt="JMV" className="size-10 rounded-lg object-contain" src="/logo.png" />
            <div>
              <p className="text-sm font-semibold">JMV Admin</p>
              <p className="text-xs text-muted-foreground">Grocery Operations</p>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Button
                  key={item.href}
                  asChild
                  className={cn("w-full justify-start gap-2", isActive && "bg-secondary text-secondary-foreground")}
                  variant={isActive ? "secondary" : "ghost"}
                >
                  <Link href={item.href}>
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="shrink-0 border-b bg-background px-5 py-4">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <img alt="JMV" className="size-10 rounded-lg object-contain" src="/logo.png" />
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold tracking-normal">JMV Admin</h1>
                  <p className="truncate text-sm text-muted-foreground">{user?.name ?? user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Boxes className="hidden size-4 text-muted-foreground sm:block" />
                <Button
                  className="gap-2"
                  variant="outline"
                  disabled={isLoggingOut}
                  onClick={() => {
                    setIsLoggingOut(true);
                    void logout();
                  }}
                >
                  <LogOut className="size-4" />
                  {isLoggingOut ? "Logging out" : "Logout"}
                </Button>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-5 py-6">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
