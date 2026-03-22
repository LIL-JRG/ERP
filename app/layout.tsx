import type { Metadata } from 'next'
import { Bricolage_Grotesque } from 'next/font/google'
import './globals.css'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700', '800'],
  variable: '--font-bricolage',
})

export const metadata: Metadata = {
  title: 'H2R ERP',
  description: 'El mejor ERP para empresas de venta de repuestos y accesorios para bicicletas desarrollado por Jorge Rasgado 🔥 | Estadía empresarial UNID 2025',
  generator: 'jrgmrc.hr',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/placeholder-logo.png" />
      </head>
      <body className={`${bricolage.variable} font-sans`}>{children}</body>
    </html>
  )
}
