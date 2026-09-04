/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
