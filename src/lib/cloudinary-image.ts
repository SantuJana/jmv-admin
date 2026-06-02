type CloudinaryImageTransformOptions = {
  width?: number;
  height?: number;
  crop?: "fill" | "fit" | "limit";
  gravity?: "auto";
  quality?: "auto" | "auto:eco" | "auto:good";
  format?: "auto";
  dpr?: "auto";
};

const CLOUDINARY_UPLOAD_PATH = "/image/upload/";

const buildTransformation = ({
  width,
  height,
  crop,
  gravity,
  quality = "auto",
  format = "auto",
  dpr
}: CloudinaryImageTransformOptions) =>
  [
    crop ? `c_${crop}` : null,
    gravity ? `g_${gravity}` : null,
    width ? `w_${width}` : null,
    height ? `h_${height}` : null,
    dpr ? `dpr_${dpr}` : null,
    format ? `f_${format}` : null,
    quality ? `q_${quality}` : null
  ]
    .filter(Boolean)
    .join(",");

export const buildCloudinaryImageUrl = (
  imageUrl: string | null,
  options: CloudinaryImageTransformOptions
) => {
  if (!imageUrl || !imageUrl.includes(CLOUDINARY_UPLOAD_PATH)) {
    return imageUrl;
  }

  const transformation = buildTransformation(options);

  if (!transformation) {
    return imageUrl;
  }

  return imageUrl.replace(CLOUDINARY_UPLOAD_PATH, `${CLOUDINARY_UPLOAD_PATH}${transformation}/`);
};

export const buildAdminThumbnailUrl = (imageUrl: string | null) =>
  buildCloudinaryImageUrl(imageUrl, {
    width: 96,
    height: 96,
    crop: "fill",
    gravity: "auto",
    quality: "auto:eco",
    format: "auto",
    dpr: "auto"
  }) ?? undefined;
