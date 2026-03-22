/** @type {import('next').NextConfig} */
import withPWA from 'next-pwa'

const nextConfig = {
  // 1. Borramos el bloque de eslint (Next 16 ya no lo acepta aquí)
  
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {}, // Esto ayuda a que Turbopack no se queje de configuraciones externas
}

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})(nextConfig)