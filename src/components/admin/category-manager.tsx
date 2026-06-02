"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/lib/api-client";
import { buildAdminThumbnailUrl } from "@/lib/cloudinary-image";
import { useAuth } from "@/providers/auth-provider";

type Category = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  imagePublicId: string | null;
  isActive: boolean;
  productsCount: number;
};

type CategoryFormState = {
  id?: string;
  name: string;
  slug: string;
  imageUrl: string;
  imagePublicId: string;
  isActive: boolean;
};

const emptyForm: CategoryFormState = {
  name: "",
  slug: "",
  imageUrl: "",
  imagePublicId: "",
  isActive: true
};

const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

export function CategoryManager() {
  const queryClient = useQueryClient();
  const { authorizedRequest, token } = useAuth();
  const [form, setForm] = useState<CategoryFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await authorizedRequest<ApiResponse<{ categories: Category[] }>>("/categories?limit=100");

      return response.data.categories;
    },
    enabled: Boolean(token)
  });

  const sortedCategories = useMemo(
    () => [...(categoriesQuery.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [categoriesQuery.data]
  );

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("image", file);
      body.append("folder", "jmv/categories");

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
    mutationFn: async (payload: CategoryFormState) => {
      let imageUrl = payload.imageUrl || undefined;
      let imagePublicId = payload.imagePublicId || undefined;

      if (selectedImage) {
        const uploadedImage = await uploadMutation.mutateAsync(selectedImage);
        imageUrl = uploadedImage.imageUrl;
        imagePublicId = uploadedImage.imagePublicId;
      }

      const body = JSON.stringify({
        name: payload.name,
        slug: payload.slug || undefined,
        imageUrl,
        imagePublicId,
        isActive: payload.isActive
      });

      if (payload.id) {
        return authorizedRequest(`/categories/${payload.id}`, {
          method: "PATCH",
          body
        });
      }

      return authorizedRequest("/categories", {
        method: "POST",
        body
      });
    },
    onSuccess: async () => {
      setForm(emptyForm);
      setSelectedImage(null);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Category could not be saved");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (categoryId: string) =>
      authorizedRequest(`/categories/${categoryId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Category could not be deleted");
    }
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    saveMutation.mutate(form);
  };

  const startEdit = (category: Category) => {
    setError(null);
    setSelectedImage(null);
    setForm({
      id: category.id,
      name: category.name,
      slug: category.slug,
      imageUrl: category.imageUrl ?? "",
      imagePublicId: category.imagePublicId ?? "",
      isActive: category.isActive
    });
  };

  const isSaving = saveMutation.isPending || uploadMutation.isPending;

  return (
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <form className="rounded-lg border bg-card p-5" onSubmit={handleSubmit}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{form.id ? "Edit Category" : "New Category"}</h2>
            <p className="text-sm text-muted-foreground">Create the catalog groups used by products.</p>
          </div>
          {form.id ? (
            <Button type="button" variant="ghost" size="icon" onClick={() => setForm(emptyForm)}>
              <X className="size-4" />
            </Button>
          ) : null}
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Name</span>
            <input
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                  slug: current.slug || toSlug(event.target.value)
                }))
              }
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Slug</span>
            <input
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: toSlug(event.target.value) }))}
              placeholder="fresh-fruits"
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

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            Active
          </label>

          {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

          <Button className="w-full gap-2" type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {form.id ? "Save Changes" : "Create Category"}
          </Button>
        </div>
      </form>

      <section className="rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-3 border-b p-5">
          <div>
            <h2 className="text-base font-semibold">Categories</h2>
            <p className="text-sm text-muted-foreground">{sortedCategories.length} catalog groups</p>
          </div>
          {categoriesQuery.isFetching ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
        </div>

        <div className="divide-y">
          {categoriesQuery.isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading categories...</div>
          ) : sortedCategories.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No categories yet.</div>
          ) : (
            sortedCategories.map((category) => (
              <div key={category.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                    {category.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" className="size-full object-cover" src={buildAdminThumbnailUrl(category.imageUrl)} />
                    ) : (
                      <ImagePlus className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{category.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {category.slug} · {category.productsCount} products
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {category.isActive ? "Active" : "Inactive"}
                  </span>
                  <Button type="button" variant="outline" size="icon" onClick={() => startEdit(category)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(category.id)}
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
