const pilotMainnet = process.env.PILOT_MAINNET === '1'

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_PILOT_MAINNET: pilotMainnet ? '1' : '',
  },
  // Pilot builds must not log PII or session data to the browser console or Vercel logs.
  compiler: pilotMainnet ? { removeConsole: { exclude: ['error', 'warn'] } } : {},
  allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok.app', '*.ngrok.io'],
  typescript: {
    ignoreBuildErrors: false, // Fixed: Enable type checking for better type safety
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@fortawesome/free-solid-svg-icons",
      "@fortawesome/react-fontawesome",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
    ],
  },
  // Fix workspace root warning - set turbopack root to current directory
  turbopack: {
    root: process.cwd(),
  },
}

export default nextConfig
