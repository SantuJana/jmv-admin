"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/lib/api-client";
import { buildAdminThumbnailUrl } from "@/lib/cloudinary-image";
import { useAuth } from "@/providers/auth-provider";

type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

type BannerFormState = {
  id?: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  imagePublicId: string;
  ctaLabel: string;
  ctaUrl: string;
  sortOrder: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

const emptyForm: BannerFormState = {
  title: "",
  subtitle: "",
  imageUrl: "",
  imagePublicId: "",
  ctaLabel: "",
  ctaUrl: "",
  sortOrder: "0",
  isActive: true,
  startsAt: "",
  endsAt: ""
};

const toDateTimeInputValue = (value: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 16);
};

const toDatePayload = (value: string) => (value ? new Date(value).toISOString() : null);

const formatSchedule = (banner: Banner) => {
  if (!banner.startsAt && !banner.endsAt) {
    return "Always visible";
  }

  const formatter = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });

  if (banner.startsAt && banner.endsAt) {
    return `${formatter.format(new Date(banner.startsAt))} - ${formatter.format(new Date(banner.endsAt))}`;
  }

  if (banner.startsAt) {
    return `From ${formatter.format(new Date(banner.startsAt))}`;
  }

  return `Until ${formatter.format(new Date(banner.endsAt as string))}`;
};

export function BannerManager() {
  const queryClient = useQueryClient();
  const { authorizedRequest, token } = useAuth();
  const [form, setForm] = useState<BannerFormState>(emptyForm);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bannersQuery = useQuery({
    queryKey: ["banners"],
    queryFn: async () => {
      const response = await authorizedRequest<ApiResponse<{ banners: Banner[] }>>("/banners/manage?limit=100");

      return response.data.banners;
    },
    enabled: Boolean(token)
  });

  const banners = useMemo(
    () => [...(bannersQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)),
    [bannersQuery.data]
  );

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("image", file);
      body.append("folder", "jmv/banners");

      const response = await authorizedRequest<ApiResponse<{ image: { imageUrl: string; imagePublicId: string } }>>(
        "/uploads/image",
        {
          method: "POST",
          body,
          isFormData: true
        }
      );

      return response.data.image;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: BannerFormState) => {
      let imageUrl: string | null = payload.imageUrl || null;
      let imagePublicId: string | null = payload.imagePublicId || null;

      if (selectedImage) {
        const uploadedImage = await uploadMutation.mutateAsync(selectedImage);
        imageUrl = uploadedImage.imageUrl;
        imagePublicId = uploadedImage.imagePublicId;
      }

      const body = JSON.stringify({
        title: payload.title,
        subtitle: payload.subtitle || null,
        imageUrl,
        imagePublicId,
        ctaLabel: payload.ctaLabel || null,
        ctaUrl: payload.ctaUrl || null,
        sortOrder: Number(payload.sortOrder || 0),
        isActive: payload.isActive,
        startsAt: toDatePayload(payload.startsAt),
        endsAt: toDatePayload(payload.endsAt)
      });

      if (payload.id) {
        return authorizedRequest(`/banners/${payload.id}`, {
          method: "PATCH",
          body
        });
      }

      return authorizedRequest("/banners", {
        method: "POST",
        body
      });
    },
    onSuccess: async () => {
      resetForm();
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["banners"] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Banner could not be saved");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (bannerId: string) =>
      authorizedRequest(`/banners/${bannerId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ["banners"] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Banner could not be deleted");
    }
  });

  const resetForm = () => {
    setForm(emptyForm);
    setSelectedImage(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    saveMutation.mutate(form);
  };

  const startEdit = (banner: Banner) => {
    setError(null);
    setSelectedImage(null);
    setForm({
      id: banner.id,
      title: banner.title,
      subtitle: banner.subtitle ?? "",
      imageUrl: banner.imageUrl ?? "",
      imagePublicId: banner.imagePublicId ?? "",
      ctaLabel: banner.ctaLabel ?? "",
      ctaUrl: banner.ctaUrl ?? "",
      sortOrder: String(banner.sortOrder),
      isActive: banner.isActive,
      startsAt: toDateTimeInputValue(banner.startsAt),
      endsAt: toDateTimeInputValue(banner.endsAt)
    });
  };

  const isSaving = saveMutation.isPending || uploadMutation.isPending;

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <form className="rounded-lg border bg-card p-5" onSubmit={handleSubmit}>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">{form.id ? "Edit Banner" : "New Banner"}</h2>
              <p className="text-sm text-muted-foreground">Add promotional artwork for the storefront.</p>
            </div>
            {form.id ? (
              <Button type="button" variant="ghost" size="icon" onClick={resetForm}>
                <X className="size-4" />
              </Button>
            ) : null}
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Title</span>
              <input
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Subtitle</span>
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={form.subtitle}
                onChange={(event) => setForm((current) => ({ ...current, subtitle: event.target.value }))}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Image</span>
              <div className="mt-1 flex items-center gap-3">
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted">
                  <ImagePlus className="size-4" />
                  Choose
                  <input
                    className="hidden"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(event) => setSelectedImage(event.target.files?.[0] ?? null)}
                  />
                </label>
                <span className="min-w-0 truncate text-sm text-muted-foreground">
                  {selectedImage?.name ?? form.imagePublicId ?? "No image selected"}
                </span>
              </div>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">CTA label</span>
                <input
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={form.ctaLabel}
                  onChange={(event) => setForm((current) => ({ ...current, ctaLabel: event.target.value }))}
                  placeholder="Shop now"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">CTA URL</span>
                <input
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={form.ctaUrl}
                  onChange={(event) => setForm((current) => ({ ...current, ctaUrl: event.target.value }))}
                  placeholder="/products?categorySlug=snacks"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm font-medium">Sort order</span>
                <input
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  min="0"
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
                />
              </label>

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

            <Button className="w-full gap-2" type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {form.id ? "Save Banner" : "Create Banner"}
            </Button>
          </div>
        </form>

        <section className="rounded-lg border bg-card">
          <div className="flex items-center justify-between gap-3 border-b p-5">
            <div>
              <h2 className="text-base font-semibold">Banners</h2>
              <p className="text-sm text-muted-foreground">{banners.length} storefront banners</p>
            </div>
            {bannersQuery.isFetching ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          </div>

          <div className="divide-y">
            {bannersQuery.isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading banners...</div>
            ) : banners.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No banners found.</div>
            ) : (
              banners.map((banner) => (
                <div key={banner.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                      {banner.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" className="size-full object-cover" src={buildAdminThumbnailUrl(banner.imageUrl)} />
                      ) : (
                        <ImagePlus className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{banner.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{banner.subtitle || "No subtitle"}</p>
                      <p className="truncate text-xs text-muted-foreground">{formatSchedule(banner)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                      #{banner.sortOrder}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {banner.isActive ? "Active" : "Inactive"}
                    </span>
                    <Button type="button" variant="outline" size="icon" onClick={() => startEdit(banner)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(banner.id)}
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
    </div>
  );
}
