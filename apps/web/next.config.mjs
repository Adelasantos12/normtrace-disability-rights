/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@normtrace/ui", "@normtrace/i18n"],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.INTERNAL_API_URL || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
