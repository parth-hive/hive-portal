import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // The add-tenant form accepts lease PDFs up to 20 MB; the default
      // server-action body limit is 1 MB. 25mb leaves headroom for the
      // multipart encoding overhead and the other form fields.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
