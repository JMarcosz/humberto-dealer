/** @type {import('next').NextConfig} */

// Extraer hostname del BACKEND_URL para allowlist de imágenes
const backendUrl      = process.env.BACKEND_URL ?? ''
const backendHostname = backendUrl ? new URL(backendUrl).hostname : null

const remotePatterns = [
  { protocol: 'https', hostname: 'images.unsplash.com' },
  ...(backendHostname ? [{ protocol: 'https', hostname: backendHostname }] : []),
]

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  compress: true,
  images: { remotePatterns },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL}/:path*`,
      },
      {
        source: '/favicon.ico',
        destination: '/logo.png',
      },
    ]
  },
}

export default nextConfig
