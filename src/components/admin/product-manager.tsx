"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Layers3, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

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
  imageUrl: string | null;
  imagePublicId: string | null;
  imageUrls?: {
    original: string | null;
    thumbnail: string | null;
    card: string | null;
    detail: string | null;
  };
  detailImages?: ProductDetailImage[];
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
  detailImages?: ProductDetailImage[];
  isActive: boolean;
  category: Category;
  variants: ProductVariant[];
};

type ProductDetailImage = {
  id?: string;
  imageUrl: string;
  imagePublicId: string;
  sortOrder: number;
};

type ProductFormState = {
  id?: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  imagePublicId: string;
  detailImages: ProductDetailImage[];
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
  imageUrl: string;
  imagePublicId: string;
  detailImages: ProductDetailImage[];
  isActive: boolean;
};

const emptyProductForm: ProductFormState = {
  categoryId: "",
  name: "",
  slug: "",
  description: "",
  imageUrl: "",
  imagePublicId: "",
  detailImages: [],
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
  imageUrl: "",
  imagePublicId: "",
  detailImages: [],
  isActive: true
};

const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

const getImageLabel = (value: string | null | undefined, fallback: string) => {
  if (!value) {
    return fallback;
  }

  const normalizedValue = value.split("?")[0].replace(/\/+$/g, "");
  const lastSegment = normalizedValue.split("/").pop();

  return lastSegment || value;
};

type ProductManagerProps = {
  view?: "products" | "variants";
};

export function ProductManager({ view = "products" }: ProductManagerProps) {
  const queryClient = useQueryClient();
  const { authorizedRequest, token } = useAuth();
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [variantForm, setVariantForm] = useState<VariantFormState>(emptyVariantForm);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedDetailImages, setSelectedDetailImages] = useState<File[]>([]);
  const [selectedVariantImage, setSelectedVariantImage] = useState<File | null>(null);
  const [selectedVariantDetailImages, setSelectedVariantDetailImages] = useState<File[]>([]);
  const [linkedProductId, setLinkedProductId] = useState<string | null>(null);
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

  const uploadDetailImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("image", file);
      body.append("folder", "jmv/products/details");

      const response = await authorizedRequest<ApiResponse<{ image: { imageUrl: string; imagePublicId: string } }>>(
        "/uploads/product-detail-image",
        {
          method: "POST",
          body,
          isFormData: true
        }
      );

      return response.data.image;
    }
  });

  const uploadVariantImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("image", file);
      body.append("folder", "jmv/products/variants");

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

  const uploadVariantDetailImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("image", file);
      body.append("folder", "jmv/products/variants/details");

      const response = await authorizedRequest<ApiResponse<{ image: { imageUrl: string; imagePublicId: string } }>>(
        "/uploads/product-detail-image",
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

      const uploadedDetailImages = await Promise.all(
        selectedDetailImages.map((file) => uploadDetailImageMutation.mutateAsync(file))
      );
      const detailImages = [
        ...payload.detailImages,
        ...uploadedDetailImages.map((image) => ({
          imageUrl: image.imageUrl,
          imagePublicId: image.imagePublicId,
          sortOrder: 0
        }))
      ].map((image, index) => ({
        imageUrl: image.imageUrl,
        imagePublicId: image.imagePublicId,
        sortOrder: index
      }));

      const body = JSON.stringify({
        categoryId: payload.categoryId,
        name: payload.name,
        slug: payload.slug || undefined,
        description: payload.description || undefined,
        imageUrl,
        imagePublicId,
        detailImages,
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
    mutationFn: async (payload: VariantFormState) => {
      let imageUrl: string | null = payload.imageUrl || null;
      let imagePublicId: string | null = payload.imagePublicId || null;

      if (selectedVariantImage) {
        const uploadedImage = await uploadVariantImageMutation.mutateAsync(selectedVariantImage);
        imageUrl = uploadedImage.imageUrl;
        imagePublicId = uploadedImage.imagePublicId;
      }

      const uploadedVariantDetailImages = await Promise.all(
        selectedVariantDetailImages.map((file) => uploadVariantDetailImageMutation.mutateAsync(file))
      );
      const detailImages = [
        ...payload.detailImages,
        ...uploadedVariantDetailImages.map((image) => ({
          imageUrl: image.imageUrl,
          imagePublicId: image.imagePublicId,
          sortOrder: 0
        }))
      ].map((image, index) => ({
        imageUrl: image.imageUrl,
        imagePublicId: image.imagePublicId,
        sortOrder: index
      }));

      const body = JSON.stringify({
        name: payload.name,
        mrp: payload.mrp,
        offerPrice: payload.offerPrice,
        price: payload.offerPrice,
        stock: Number(payload.stock),
        sku: payload.sku,
        unit: payload.unit,
        imageUrl,
        imagePublicId,
        detailImages,
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
      resetVariantForm(variantForm.productId);
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
  const isSavingProduct = saveProductMutation.isPending || uploadMutation.isPending || uploadDetailImageMutation.isPending;
  const isSavingVariant =
    saveVariantMutation.isPending || uploadVariantImageMutation.isPending || uploadVariantDetailImageMutation.isPending;
  const productsError = productsQuery.error instanceof Error ? productsQuery.error.message : null;

  useEffect(() => {
    if (view !== "variants") {
      return;
    }

    const productsData = productsQuery.data ?? [];
    const nextProductId = linkedProductId && productsData.some((product) => product.id === linkedProductId)
      ? linkedProductId
      : productsData[0]?.id;

    if (nextProductId && variantForm.productId !== nextProductId) {
      setVariantForm({ ...emptyVariantForm, productId: nextProductId });
      setSelectedVariantImage(null);
      setSelectedVariantDetailImages([]);
    }
  }, [linkedProductId, productsQuery.data, variantForm.productId, view]);

  useEffect(() => {
    if (view !== "variants") {
      return;
    }

    setLinkedProductId(new URLSearchParams(window.location.search).get("productId"));
  }, [view]);

  function resetProductForm() {
    setProductForm(emptyProductForm);
    setSelectedImage(null);
    setSelectedDetailImages([]);
  }

  function resetVariantForm(productId = variantForm.productId) {
    setVariantForm({ ...emptyVariantForm, productId });
    setSelectedVariantImage(null);
    setSelectedVariantDetailImages([]);
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
      detailImages: (product.detailImages ?? []).map((image, index) => ({
        imageUrl: image.imageUrl,
        imagePublicId: image.imagePublicId,
        sortOrder: image.sortOrder ?? index
      })),
      isActive: product.isActive
    });
    resetVariantForm(product.id);
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
      imageUrl: variant.imageUrl ?? "",
      imagePublicId: variant.imagePublicId ?? "",
      detailImages: (variant.detailImages ?? []).map((image, index) => ({
        imageUrl: image.imageUrl,
        imagePublicId: image.imagePublicId,
        sortOrder: image.sortOrder ?? index
      })),
      isActive: variant.isActive
    });
    setSelectedVariantImage(null);
    setSelectedVariantDetailImages([]);
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

      {view === "products" ? (
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
              <div className="mt-1 grid min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 overflow-hidden">
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

            <label className="block">
              <span className="text-sm font-medium">Detail Images</span>
              <div className="mt-1 flex min-w-0 max-w-full items-center gap-3 overflow-hidden">
                <label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted">
                  <ImagePlus className="size-4" />
                  Add
                  <input
                    className="hidden"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    multiple
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      setSelectedDetailImages((current) => [...current, ...files]);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <span className="block min-w-0 flex-1 basis-0 truncate rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {productForm.detailImages.length + selectedDetailImages.length} detail images
                </span>
              </div>
              {productForm.detailImages.length || selectedDetailImages.length ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {productForm.detailImages.map((image) => (
                    <div key={image.imagePublicId} className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt=""
                        className="size-full object-cover"
                        src={buildAdminThumbnailUrl(image.imageUrl)}
                      />
                      <button
                        type="button"
                        className="absolute right-1 top-1 inline-flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm"
                        onClick={() =>
                          setProductForm((current) => ({
                            ...current,
                            detailImages: current.detailImages.filter(
                              (currentImage) => currentImage.imagePublicId !== image.imagePublicId
                            )
                          }))
                        }
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                  {selectedDetailImages.map((file, index) => (
                    <div key={`${file.name}-${file.lastModified}-${index}`} className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                      <div className="flex size-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
                        <span className="line-clamp-3 break-all">{file.name}</span>
                      </div>
                      <button
                        type="button"
                        className="absolute right-1 top-1 inline-flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm"
                        onClick={() =>
                          setSelectedDetailImages((current) => current.filter((_, fileIndex) => fileIndex !== index))
                        }
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
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
              products.map((product) => {
                const isSelectedForVariants = selectedProduct?.id === product.id;

                return (
                <div
                  key={product.id}
                  className={[
                    "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
                    isSelectedForVariants ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""
                  ].join(" ")}
                >
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

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {product.isActive ? "Active" : "Inactive"}
                    </span>
                    <Button asChild variant="outline" size="sm" className="gap-2" title="Manage variants">
                      <Link href={`/products/variants?productId=${product.id}`}>
                        <Layers3 className="size-4" />
                        Variants
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Edit product"
                      onClick={() => startProductEdit(product)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Delete product"
                      disabled={deleteProductMutation.isPending}
                      onClick={() => deleteProductMutation.mutate(product.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                );
              })
            )}
          </div>
        </section>
      </div>
      ) : null}

      {view === "variants" ? (
      <section className="rounded-lg border bg-card p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Variants</h2>
            <p className="truncate text-sm text-muted-foreground">
              {selectedProduct ? `${selectedProduct.name} · ${selectedProduct.variants.length} variants` : "Select a product"}
            </p>
          </div>
          {selectedProduct ? (
            <Button type="button" variant="outline" className="gap-2" onClick={() => resetVariantForm(selectedProduct.id)}>
              <Plus className="size-4" />
              New Variant
            </Button>
          ) : null}
        </div>

        {productsQuery.isLoading ? (
          <div className="rounded-md border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            Loading products...
          </div>
        ) : productsQuery.isError ? (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {productsError ?? "Products could not be loaded"}
          </div>
        ) : (productsQuery.data ?? []).length === 0 ? (
          <div className="rounded-md border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            Create a product before adding variants.
          </div>
        ) : (
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <form className="space-y-4 lg:sticky lg:top-24 lg:self-start" onSubmit={handleVariantSubmit}>
            <label className="block">
              <span className="text-sm font-medium">Product</span>
              <select
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={variantForm.productId}
                onChange={(event) => resetVariantForm(event.target.value)}
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

            <label className="block">
              <span className="text-sm font-medium">Variant Image</span>
              <div className="mt-1 grid min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 overflow-hidden">
                <label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted">
                  <ImagePlus className="size-4" />
                  Choose
                  <input
                    className="hidden"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(event) => setSelectedVariantImage(event.target.files?.[0] ?? null)}
                  />
                </label>
                <span
                  className="block h-10 min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
                  title={selectedVariantImage?.name ?? variantForm.imagePublicId ?? "Use product image"}
                >
                  {selectedVariantImage?.name ?? getImageLabel(variantForm.imagePublicId, "Use product image")}
                </span>
              </div>
              {variantForm.imageUrl || selectedVariantImage ? (
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-destructive"
                  onClick={() => {
                    setSelectedVariantImage(null);
                    setVariantForm((current) => ({ ...current, imageUrl: "", imagePublicId: "" }));
                  }}
                >
                  Remove variant image
                </button>
              ) : null}
            </label>

            <label className="block">
              <span className="text-sm font-medium">Variant Detail Images</span>
              <div className="mt-1 grid min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 overflow-hidden">
                <label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted">
                  <ImagePlus className="size-4" />
                  Add
                  <input
                    className="hidden"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    multiple
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      setSelectedVariantDetailImages((current) => [...current, ...files]);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <span className="block h-10 min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {variantForm.detailImages.length + selectedVariantDetailImages.length} detail images
                </span>
              </div>
              {variantForm.detailImages.length || selectedVariantDetailImages.length ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {variantForm.detailImages.map((image) => (
                    <div key={image.imagePublicId} className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="" className="size-full object-cover" src={buildAdminThumbnailUrl(image.imageUrl)} />
                      <button
                        type="button"
                        className="absolute right-1 top-1 inline-flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm"
                        onClick={() =>
                          setVariantForm((current) => ({
                            ...current,
                            detailImages: current.detailImages.filter(
                              (currentImage) => currentImage.imagePublicId !== image.imagePublicId
                            )
                          }))
                        }
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                  {selectedVariantDetailImages.map((file, index) => (
                    <div key={`${file.name}-${file.lastModified}-${index}`} className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                      <div className="flex size-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
                        <span className="line-clamp-3 break-all">{file.name}</span>
                      </div>
                      <button
                        type="button"
                        className="absolute right-1 top-1 inline-flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm"
                        onClick={() =>
                          setSelectedVariantDetailImages((current) =>
                            current.filter((_, fileIndex) => fileIndex !== index)
                          )
                        }
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={variantForm.isActive}
                onChange={(event) => setVariantForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
              Active
            </label>

            <div className="flex gap-2">
              <Button className="flex-1 gap-2" type="submit" disabled={isSavingVariant}>
                {isSavingVariant ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {variantForm.id ? "Save Variant" : "Add Variant"}
              </Button>
              {variantForm.id ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => resetVariantForm()}
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
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                        {variant.imageUrl ?? variant.imageUrls?.thumbnail ?? selectedProduct.imageUrls?.thumbnail ?? selectedProduct.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt=""
                            className="size-full object-cover"
                            src={buildAdminThumbnailUrl(
                              variant.imageUrl ??
                                variant.imageUrls?.thumbnail ??
                                selectedProduct.imageUrls?.thumbnail ??
                                selectedProduct.imageUrl
                            )}
                          />
                        ) : (
                          <ImagePlus className="size-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{variant.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {variant.sku} · {variant.unit} · stock {variant.stock} · MRP Rs. {variant.mrp} · Offer Rs.{" "}
                          {variant.offerPrice ?? variant.price}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                        {variant.isActive ? "Active" : "Inactive"}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        title="Edit variant"
                        onClick={() => startVariantEdit(variant, selectedProduct.id)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        title="Delete variant"
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
        )}
      </section>
      ) : null}
    </div>
  );
}
