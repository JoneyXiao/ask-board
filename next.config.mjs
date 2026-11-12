/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/ask-board',
  assetPrefix: '/ask-board',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

export default nextConfig
