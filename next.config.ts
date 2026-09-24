import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "@node-rs/argon2", "@prisma/client"],
  experimental: { serverActions: { bodySizeLimit: "110mb" } },
  poweredByHeader: false,
  // a antiga sala "Lobby" virou "Geral"
  async redirects() {
    return [{ source: "/lobby/:path*", destination: "/geral/:path*", permanent: false }, { source: "/lobby", destination: "/geral", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" }, // microfone: áudio do ao vivo
        ],
      },
    ];
  },
};

export default nextConfig;
