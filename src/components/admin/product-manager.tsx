"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/lib/api-client";
import { buildAdminThumbnailUrl } from "@/lib/object-storage-image";
import { useAuth } from "@/providers/auth-provider";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type ProductVariant = {
  id: string;
  name: string;
  mrp: string;
  price: string;
  offerPrice?: string;
  stock: number;
  sku: string;
  unit: string;
  isActive: boolean;
};

type Product = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  imageUrls?: {
    original: string | null;
    thumbnail: string | null;
    card: string | null;
    detail: string | null;
  };
  isActive: boolean;
  category: Category;
  variants: ProductVariant[];
};

type ProductFormState = {
  id?: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  imagePublicId: string;
  isActive: boolean;
};

type VariantFormState = {
  id?: string;
  productId: string;
  name: string;
  mrp: string;
  offerPrice: string;
  stock: string;
  sku: string;
  unit: string;
  isActive: boolean;
};

const emptyProductForm: ProductFormState = {
  categoryId: "",
  name: "",
  slug: "",
  description: "",
  imageUrl: "",
  imagePublicId: "",
  isActive: true
};

const emptyVariantForm: VariantFormState = {
  productId: "",
  name: "",
  mrp: "",
  offerPrice: "",
  stock: "0",
  sku: "",
  unit: "",
  isActive: true
};

const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

export function ProductManager() {
  const queryClient = useQueryClient();
  const { authorizedRequest, token } = useAuth();
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [variantForm, setVariantForm] = useState<VariantFormState>(emptyVariantForm);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await authorizedRequest<ApiResponse<{ categories: Category[] }>>("/categories?limit=100");

      return response.data.categories;
    },
    enabled: Boolean(token)
  });

  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await authorizedRequest<ApiResponse<{ products: Product[] }>>("/products/manage?limit=100");

      return response.data.products;
    },
    enabled: Boolean(token)
  });

  const products = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...(productsQuery.data ?? [])]
      .filter((product) => (categoryFilter ? product.categoryId === categoryFilter : true))
      .filter((product) => {
        if (!normalizedSearch) {
          return true;
        }

        return (
          product.name.toLowerCase().includes(normalizedSearch) ||
          product.slug.toLowerCase().includes(normalizedSearch) ||
          product.category.name.toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categoryFilter, productsQuery.data, search]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("image", file);
      body.append("folder", "jmv/products");

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

  const saveProductMutation = useMutation({
    mutationFn: async (payload: ProductFormState) => {
      let imageUrl = payload.imageUrl || undefined;
      let imagePublicId = payload.imagePublicId || undefined;

      if (selectedImage) {
        const uploadedImage = await uploadMutation.mutateAsync(selectedImage);
        imageUrl = uploadedImage.imageUrl;
        imagePublicId = uploadedImage.imagePublicId;
      }

      const body = JSON.stringify({
        categoryId: payload.categoryId,
        name: payload.name,
        slug: payload.slug || undefined,
        description: payload.description || undefined,
        imageUrl,
        imagePublicId,
        isActive: payload.isActive
      });

      if (payload.id) {
        return authorizedRequest(`/products/${payload.id}`, {
          method: "PATCH",
          body
        });
      }

      return authorizedRequest("/products", {
        method: "POST",
        body
      });
    },
    onSuccess: async () => {
      resetProductForm();
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Product could not be saved");
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: (productId: string) =>
      authorizedRequest(`/products/${productId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      resetProductForm();
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Product could not be deleted");
    }
  });

  const saveVariantMutation = useMutation({
    mutationFn: (payload: VariantFormState) => {
      const body = JSON.stringify({
        name: payload.name,
        mrp: payload.mrp,
        offerPrice: payload.offerPrice,
        price: payload.offerPrice,
        stock: Number(payload.stock),
        sku: payload.sku,
        unit: payload.unit,
        isActive: payload.isActive
      });

      if (payload.id) {
        return authorizedRequest(`/products/variants/${payload.id}`, {
          method: "PATCH",
          body
        });
      }

      return authorizedRequest(`/products/${payload.productId}/variants`, {
        method: "POST",
        body
      });
    },
    onSuccess: async () => {
      setVariantForm((current) => ({ ...emptyVariantForm, productId: current.productId }));
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Variant could not be saved");
    }
  });

  const deleteVariantMutation = useMutation({
    mutationFn: (variantId: string) =>
      authorizedRequest(`/products/variants/${variantId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Variant could not be deleted");
    }
  });

  const selectedProduct = productsQuery.data?.find((product) => product.id === variantForm.productId) ?? null;
  const isSavingProduct = saveProductMutation.isPending || uploadMutation.isPending;

  function resetProductForm() {
    setProductForm(emptyProductForm);
    setSelectedImage(null);
  }

  const startProductEdit = (product: Product) => {
    setError(null);
    setSelectedImage(null);
    setProductForm({
      id: product.id,
      categoryId: product.categoryId,
      name: product.name,
      slug: product.slug,
      description: product.description ?? "",
      imageUrl: product.imageUrl ?? "",
      imagePublicId: product.imagePublicId ?? "",
      isActive: product.isActive
    });
    setVariantForm((current) => ({ ...current, productId: product.id }));
  };

  const startVariantEdit = (variant: ProductVariant, productId: string) => {
    setError(null);
    setVariantForm({
      id: variant.id,
      productId,
      name: variant.name,
      mrp: variant.mrp,
      offerPrice: variant.offerPrice ?? variant.price,
      stock: String(variant.stock),
      sku: variant.sku,
      unit: variant.unit,
      isActive: variant.isActive
    });
  };

  const handleProductSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    saveProductMutation.mutate(productForm);
  };

  const handleVariantSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    saveVariantMutation.mutate(variantForm);
  };

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <form
          className="min-w-0 rounded-lg border bg-card p-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
          onSubmit={handleProductSubmit}
        >
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">{productForm.id ? "Edit Product" : "New Product"}</h2>
              <p className="text-sm text-muted-foreground">Add catalog items and attach product images.</p>
            </div>
            {productForm.id ? (
              <Button type="button" variant="ghost" size="icon" onClick={resetProductForm}>
                <X className="size-4" />
              </Button>
            ) : null}
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Category</span>
              <select
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={productForm.categoryId}
                onChange={(event) => setProductForm((current) => ({ ...current, categoryId: event.target.value }))}
                required
              >
                <option value="">Select category</option>
                {(categoriesQuery.data ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium">Name</span>
              <input
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={productForm.name}
                onChange={(event) =>
                  setProductForm((current) => ({
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
                value={productForm.slug}
                onChange={(event) => setProductForm((current) => ({ ...current, slug: toSlug(event.target.value) }))}
                placeholder="shimla-apple"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Description</span>
              <textarea
                className="mt-1 min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={productForm.description}
                onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Image</span>
              <div className="mt-1 flex min-w-0 max-w-full items-center gap-3 overflow-hidden">
                <label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted">
                  <ImagePlus className="size-4" />
                  Choose
                  <input
                    className="hidden"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(event) => setSelectedImage(event.target.files?.[0] ?? null)}
                  />
                </label>
                <span
                  className="block min-w-0 flex-1 basis-0 truncate rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
                  title={selectedImage?.name ?? productForm.imagePublicId ?? "No image selected"}
                >
                  {selectedImage?.name ?? productForm.imagePublicId ?? "No image selected"}
                </span>
              </div>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={productForm.isActive}
                onChange={(event) => setProductForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
              Active
            </label>

            <Button className="w-full gap-2" type="submit" disabled={isSavingProduct}>
              {isSavingProduct ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {productForm.id ? "Save Product" : "Create Product"}
            </Button>
          </div>
        </form>

        <section className="min-w-0 rounded-lg border bg-card">
          <div className="space-y-3 border-b p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Products</h2>
                <p className="text-sm text-muted-foreground">{products.length} catalog items</p>
              </div>
              {productsQuery.isFetching ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search products"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="">All categories</option>
                {(categoriesQuery.data ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="max-h-[34rem] divide-y overflow-y-auto lg:max-h-[calc(100vh-18rem)]">
            {productsQuery.isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading products...</div>
            ) : products.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No products found.</div>
            ) : (
              products.map((product) => (
                <div key={product.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                      {product.imageUrls?.thumbnail ?? product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt=""
                          className="size-full object-cover"
                          src={buildAdminThumbnailUrl(product.imageUrls?.thumbnail ?? product.imageUrl)}
                        />
                      ) : (
                        <ImagePlus className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{product.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {product.category.name} · {product.variants.length} variants
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {product.isActive ? "Active" : "Inactive"}
                    </span>
                    <Button type="button" variant="outline" size="icon" onClick={() => startProductEdit(product)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={deleteProductMutation.isPending}
                      onClick={() => deleteProductMutation.mutate(product.id)}
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

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-5">
          <h2 className="text-base font-semibold">Variants</h2>
          <p className="text-sm text-muted-foreground">Manage MRP, offer price, stock, SKU, and units for a selected product.</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <form className="space-y-4 lg:sticky lg:top-24 lg:self-start" onSubmit={handleVariantSubmit}>
            <label className="block">
              <span className="text-sm font-medium">Product</span>
              <select
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={variantForm.productId}
                onChange={(event) => setVariantForm((current) => ({ ...current, productId: event.target.value }))}
                required
              >
                <option value="">Select product</option>
                {(productsQuery.data ?? []).map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">Variant name</span>
                <input
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={variantForm.name}
                  onChange={(event) => setVariantForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="1 kg"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">Unit</span>
                <input
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={variantForm.unit}
                  onChange={(event) => setVariantForm((current) => ({ ...current, unit: event.target.value }))}
                  placeholder="kg"
                  required
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <label className="block">
                <span className="text-sm font-medium">MRP</span>
                <input
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={variantForm.mrp}
                  onChange={(event) => setVariantForm((current) => ({ ...current, mrp: event.target.value }))}
                  placeholder="120.00"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">Offer price</span>
                <input
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={variantForm.offerPrice}
                  onChange={(event) => setVariantForm((current) => ({ ...current, offerPrice: event.target.value }))}
                  placeholder="99.00"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">Stock</span>
                <input
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  type="number"
                  min="0"
                  value={variantForm.stock}
                  onChange={(event) => setVariantForm((current) => ({ ...current, stock: event.target.value }))}
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">SKU</span>
                <input
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={variantForm.sku}
                  onChange={(event) => setVariantForm((current) => ({ ...current, sku: event.target.value }))}
                  placeholder="APPLE-1KG"
                  required
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={variantForm.isActive}
                onChange={(event) => setVariantForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
              Active
            </label>

            <div className="flex gap-2">
              <Button className="flex-1 gap-2" type="submit" disabled={saveVariantMutation.isPending}>
                {saveVariantMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {variantForm.id ? "Save Variant" : "Add Variant"}
              </Button>
              {variantForm.id ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setVariantForm((current) => ({ ...emptyVariantForm, productId: current.productId }))}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>

          <div className="rounded-md border">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-medium">{selectedProduct?.name ?? "Select a product"}</p>
            </div>
            <div className="divide-y">
              {!selectedProduct ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Choose a product to manage variants.</div>
              ) : selectedProduct.variants.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No variants yet.</div>
              ) : (
                selectedProduct.variants.map((variant) => (
                  <div key={variant.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">{variant.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {variant.sku} · {variant.unit} · stock {variant.stock} · MRP Rs. {variant.mrp} · Offer Rs.{" "}
                        {variant.offerPrice ?? variant.price}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                        {variant.isActive ? "Active" : "Inactive"}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => startVariantEdit(variant, selectedProduct.id)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={deleteVariantMutation.isPending}
                        onClick={() => deleteVariantMutation.mutate(variant.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
