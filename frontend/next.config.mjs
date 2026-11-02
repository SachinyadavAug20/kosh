/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { webpack }) => {
    // manifold-3d's Emscripten glue contains Node-only imports
    // (`node:module`, `node:fs`, `node:path`, `node:url`) behind
    // ENVIRONMENT_IS_NODE runtime guards. Webpack cannot resolve the
    // `node:` scheme for browser builds, so ignore those requests only
    // when they originate from the manifold-3d package itself.
    config.plugins.push(
      new webpack.IgnorePlugin({
        checkResource: (resource, context) =>
          resource.startsWith("node:") &&
          typeof context === "string" &&
          context.includes("manifold-3d"),
      })
    );
    return config;
  },
};

export default nextConfig;
