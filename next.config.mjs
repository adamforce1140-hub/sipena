/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Paket ini harus dijalankan sebagai modul Node (bukan dibundel webpack)
    serverComponentsExternalPackages: ["@react-pdf/renderer", "xlsx"],
    // PDFKit memuat standard font (Helvetica dkk) secara dinamis lewat
    // createRequire, sehingga tidak terdeteksi file tracing biasa.
    // Tanpa ini, route PDF gagal di serverless dengan:
    // "Cannot find module '.../pdfkit/js/standard-fonts/Helvetica.cjs'"
    outputFileTracingIncludes: {
      "/api/**": ["node_modules/pdfkit/js/standard-fonts/**/*.cjs"],
      "**": ["node_modules/pdfkit/js/standard-fonts/**/*.cjs"],
    },
  },
};

export default nextConfig;
