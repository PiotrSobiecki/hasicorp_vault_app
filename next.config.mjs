/** @type {import("next").NextConfig} */

const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  // Prevent embedding in iframes (clickjacking protection)
  { key: "X-Frame-Options", value: "DENY" },
  // Enforce HTTPS for one year (HSTS)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  // Do not auto-detect MIME types
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Do not leak URL to external services
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Browser API permissions
  // camera=(self) — required for QR code scanner in the entry form
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=()",
  },
  // Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // unsafe-inline required by Next.js / Chakra UI
      // unsafe-eval only in dev (Next.js hot reload); removed in production
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'",
      // unsafe-inline required by Chakra UI inline styles
      "style-src 'self' 'unsafe-inline'",
      // font-src: self only (no Google Fonts used)
      "font-src 'self'",
      // img-src: self + data: (inline QR code / base64 images)
      // No Google domains — favicons are proxied through /api/favicon
      "img-src 'self' data: blob:",
      // connect-src: self (all API calls go to own server)
      "connect-src 'self'",
      // media-src: self (getUserMedia / camera stream for QR scanner)
      "media-src 'self'",
      // worker-src: self blob: (Next.js service worker)
      "worker-src 'self' blob:",
      // Prevent any frame embedding
      "frame-ancestors 'none'",
      // Restrict base tag
      "base-uri 'self'",
      // Restrict form submissions
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
