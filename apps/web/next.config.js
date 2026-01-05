/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
  // Environment variables accessible on the client
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },

  // Configure allowed image domains for next/image
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: 'ia.media-imdb.com',
        pathname: '/images/**',
      },
    ],
  },
};

module.exports = nextConfig;
