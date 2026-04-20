const CopyPlugin = require("copy-webpack-plugin");
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https?.*\/api\/.*/i,
      handler: "NetworkOnly",
      options: {
        cacheName: "api-calls",
      },
    },
  ],
  buildExcludes: [/middleware-manifest\.json$/],
});

// Use undefined for standard server output (supports API routes)
// Set NEXT_OUTPUT=export for static export, or NEXT_OUTPUT=standalone for containerized deployment
const output = process.env.NEXT_OUTPUT || undefined;

// Replit preview subdomains are only needed during `next dev`. In any
// non-development build we omit the field entirely so production bundles
// don't advertise those origins.
const isDev = process.env.NODE_ENV === "development";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output,
  reactStrictMode: false,
  assetPrefix: process.env.BASE_PATH || "",
  basePath: process.env.BASE_PATH || "",
  trailingSlash: false,
  ...(isDev && {
    allowedDevOrigins: [
      "*.replit.dev",
      "*.picard.replit.dev",
      "*.replit.app",
    ],
  }),
  publicRuntimeConfig: {
    root: process.env.BASE_PATH || "",
  },
  optimizeFonts: false,
  images: {
    unoptimized: true,
  },
  // Baseline security headers applied to every response. CSP is deliberately
  // omitted here because the 3D/WebGL stack needs inline workers, eval for
  // shaders, and external model/CDN fetches — wiring a correct CSP requires
  // a dedicated pass. Everything below is a safe default.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Permissions-Policy", value: "interest-cohort=()" },
        ],
      },
    ];
  },
  webpack: (config, { webpack, buildId, isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    config.plugins.push(
      new CopyPlugin({
        patterns: [
          {
            from: "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm",
            to: "static/chunks/[name][ext]",
            noErrorOnMissing: true,
          },
          {
            from: "./node_modules/onnxruntime-web/dist/ort-wasm-threaded.wasm",
            to: "static/chunks/[name][ext]",
            noErrorOnMissing: true,
          },
          {
            from: "./node_modules/onnxruntime-web/dist/ort-wasm.wasm",
            to: "static/chunks/[name][ext]",
            noErrorOnMissing: true,
          },
          {
            from: "./node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm",
            to: "static/chunks/[name][ext]",
            noErrorOnMissing: true,
          },
          {
            from: "node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js",
            to: "static/chunks/[name][ext]",
            noErrorOnMissing: true,
          },
          {
            from: "node_modules/@ricky0123/vad-web/dist/*.onnx",
            to: "static/chunks/[name][ext]",
            noErrorOnMissing: true,
          },
        ],
      }),
    );

    config.plugins.push(
      new webpack.DefinePlugin({
        "process.env.NEXT_PUBLIC_CONFIG_BUILD_ID": JSON.stringify(buildId),
      }),
    );

    return config;
  },
};

module.exports = withPWA(nextConfig);
