/** @type {import("next").NextConfig} */

const securityHeaders = [
  // Zakaz osadzania w iframe (ochrona przed clickjackingiem)
  { key: "X-Frame-Options", value: "DENY" },
  // Wymuszenie HTTPS przez rok (HSTS)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  // Nie wykrywaj automatycznie typów MIME
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Polityka referrer – nie wyciekaj URL do zewnętrznych serwisów
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Ogranicz dostęp do API przeglądarki
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Content Security Policy
  // – skrypty: tylko własna domena + Google Fonts
  // – style: własna domena + Google Fonts (unsafe-inline wymagane przez Chakra UI)
  // – img: własna domena + Google favicon API (favikony serwisów)
  // – connect: własna domena (API calls)
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval wymagane przez Next.js dev
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https://www.google.com https://*.gstatic.com", // Google favicon API (może redirectować na gstatic.com)
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
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
  // Zezwól na favicon z Google (zewnętrzne domeny w img)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.google.com",
        pathname: "/s2/favicons/**",
      },
    ],
  },
};

export default nextConfig;
