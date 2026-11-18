/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Paket ini harus dijalankan sebagai modul Node (bukan dibundel webpack)
    serverComponentsExternalPackages: ["@react-pdf/renderer", "xlsx"],
  },
};

export default nextConfig;
