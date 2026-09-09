/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/api/cards/*/print-package": ["./assets/print-package/**/*", "./public/signature-icons/*.png", "./public/brands/*"],
  },
  async headers() {
    return [{source:"/:path*",headers:[
      {key:"X-Content-Type-Options",value:"nosniff"},
      {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
      {key:"X-Frame-Options",value:"DENY"},
      {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"},
    ]}, {source:"/auth/:path*",headers:[{key:"Cache-Control",value:"private, no-store"},{key:"Referrer-Policy",value:"no-referrer"}]}];
  },
  webpack: (config) => {
    // node_modules lives on a Parallels shared folder (Mac -> Windows), whose
    // virtualized filesystem doesn't reliably support the readlink calls
    // webpack's default symlink resolution makes while walking node_modules
    // (surfaces as "EISDIR: illegal operation on a directory, readlink ...").
    // There are no real symlinks to resolve in this flat npm install, so
    // this is safe to turn off rather than work around per-file.
    config.resolve.symlinks = false;
    return config;
  },
};

export default nextConfig;
