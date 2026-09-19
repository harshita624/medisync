/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    domains: ["res.cloudinary.com", "lh3.googleusercontent.com", "api.qrserver.com"],
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
