/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
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
