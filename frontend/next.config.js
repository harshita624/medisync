/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["res.cloudinary.com", "lh3.googleusercontent.com", "api.qrserver.com"],
  },
  async rewrites() {
    return [
      {
        source:      "/api/:path*",
        destination: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/:path*`,
      },
      {
        source:      "/uploads/:path*",
        destination: `${process.env.BACKEND_URL || "http://localhost:5000"}/uploads/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source:  "/(.*)",
        headers: [{ key: "ngrok-skip-browser-warning", value: "true" }],
      },
    ];
  },
  webpack(config, { isServer }) {
    if (!isServer) config.output = { ...config.output, chunkLoadTimeout: 120000 };
    return config;
  },
};

module.exports = nextConfig;