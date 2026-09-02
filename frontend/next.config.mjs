/** @type {import('next').NextConfig} */

// Extraer hostname del BACKEND_URL para allowlist de imágenes
const backendUrl      = process.env.BACKEND_URL || 'http://127.0.0.1:5001/api'
const backendHostname = backendUrl.startsWith('http') ? new URL(backendUrl).hostname : null

const remotePatterns = [
  { protocol: 'https', hostname: 'images.unsplash.com' },
  ...(backendHostname ? [{ protocol: 'http', hostname: backendHostname }, { protocol: 'https', hostname: backendHostname }] : []),
]

const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  compress: true,
  images: { remotePatterns },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
      },
      {
        source: '/favicon.ico',
        destination: '/logo.png',
      },
    ]
  },
}

export default nextConfig
