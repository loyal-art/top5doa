import type { Metadata } from "next";

/**
 * Site-wide constants for metadata and Open Graph.
 *
 * SITE_URL backs `metadataBase` in the root layout. Next resolves relative
 * metadata image paths against it, which is what makes og:image absolute —
 * crawlers do not resolve relative paths.
 *
 * Override with NEXT_PUBLIC_SITE_URL when a deployment is served from another
 * origin (a preview URL, or a custom domain change); otherwise production is
 * assumed. It must be an absolute origin with no trailing slash.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "https://top5doa.app";

export const SITE_NAME = "Top5DOA";

export const SITE_DESCRIPTION =
  "Debate the greatest of all time across any category";

/**
 * Static 1200x630 fallback, used whenever a page has no image of its own.
 * Regenerate with `node scripts/generate-og-default.mjs`.
 */
export const OG_DEFAULT_IMAGE = "/images/og-default.png";

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** True only for absolute http(s) URLs — the only thing a crawler can fetch. */
export function isAbsoluteHttpUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

type SocialMetadataInput = {
  title: string;
  description: string;
  /** Site-relative path, e.g. `/topics/foo`. Becomes og:url. */
  path: string;
  /** Absolute image URL. Falls back to the static image when absent or relative. */
  image?: string | null;
  imageWidth?: number;
  imageHeight?: number;
  imageAlt?: string;
  type?: "website" | "article" | "profile";
};

/**
 * Build the openGraph/twitter blocks for a page.
 *
 * Dimensions are only declared when they are actually known — for the static
 * fallback and for stored posters. Topic art is hotlinked from third parties at
 * unknown sizes, and declaring wrong dimensions is worse than declaring none:
 * crawlers trust the tags over the bytes and render a broken crop.
 */
export function socialMetadata({
  title,
  description,
  path,
  image,
  imageWidth,
  imageHeight,
  imageAlt,
  type = "website",
}: SocialMetadataInput): Metadata {
  const usingFallback = !isAbsoluteHttpUrl(image);
  const imageUrl = usingFallback ? OG_DEFAULT_IMAGE : image;

  const width = usingFallback ? OG_IMAGE_WIDTH : imageWidth;
  const height = usingFallback ? OG_IMAGE_HEIGHT : imageHeight;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      siteName: SITE_NAME,
      title,
      description,
      url: path,
      images: [
        {
          url: imageUrl,
          ...(width ? { width } : {}),
          ...(height ? { height } : {}),
          alt: imageAlt ?? title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}
