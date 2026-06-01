/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  compress: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'humberto-dealer.onrender.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://humberto-dealer.onrender.com/api/:path*',
      },
      {
        source: '/favicon.ico',
        destination: '/logo.png',
      },
    ]
  },
}

export default nextConfig
