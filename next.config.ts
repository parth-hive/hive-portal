import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // The add-tenant form accepts lease PDFs up to 20 MB; the default
      // server-action body limit is 1 MB. 25mb leaves headroom for the
      // multipart encoding overhead and the other form fields.
      bodySizeLimit: "25mb",
    },
    // Revisiting a page within 30s serves the client-cached copy instantly
    // instead of re-rendering on the server. Server actions still bust this
    // via revalidatePath, so our own edits always show immediately.
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
