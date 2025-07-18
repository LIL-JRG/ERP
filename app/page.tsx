"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import LoginForm from "@/components/auth/login-form"
import DashboardLayout from "@/components/dashboard/dashboard-layout"
import ProductsManager from "@/components/products/products-manager"
import BarcodeScanner from "@/components/scanner/barcode-scanner"
import DashboardChart from "@/components/dashboard/dashboard-chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, ShoppingCart, FileText, TrendingDown, Users, DollarSign, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import InventoryManager from "@/components/inventory/inventory-manager"
import CustomersManager from "@/components/customers/customers-manager"
import SalesManager from "@/components/sales/sales-manager"
import QuotesManager from "@/components/quotes/quotes-manager"
import SettingsManager from "@/components/settings/settings-manager"
import QuickEntries from "@/components/cash/quick-entries"
import QuickExits from "@/components/cash/quick-exits"
import { useSettings } from "@/hooks/use-settings"

export default function Home() {
  const { formatCurrency } = useSettings()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("dashboard")
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
    totalCustomers: 0,
    monthSales: 0,
    monthSalesCount: 0,
    pendingQuotes: 0,
    convertedQuotes: 0,
    todayMovements: 0,
    todayEntries: 0,
    todayExits: 0,
    todayNetCash: 0,
  })

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      fetchStats()

      // Actualizar estadísticas cada 5 minutos
      const interval = setInterval(
        () => {
          if (activeTab === "dashboard") {
            fetchStats()
          }
        },
        5 * 60 * 1000,
      ) // 5 minutos

      return () => clearInterval(interval)
    }
  }, [user, activeTab])

  // Actualizar estadísticas cuando se cambia a la pestaña dashboard
  useEffect(() => {
    if (user && activeTab === "dashboard") {
      const timeSinceLastUpdate = Date.now() - lastUpdate.getTime()
      // Si han pasado más de 2 minutos, actualizar
      if (timeSinceLastUpdate > 2 * 60 * 1000) {
        fetchStats()
      }
    }
  }, [activeTab, user, lastUpdate])

  const fetchStats = useCallback(async () => {
    if (statsLoading) return

    setStatsLoading(true)
    try {
      // Obtener estadísticas de productos
      const { data: products } = await supabase.from("products").select("stock_quantity, min_stock")

      const totalProducts = products?.length || 0
      const lowStockProducts =
        products?.filter((p) => p.stock_quantity <= p.min_stock && p.stock_quantity > 0).length || 0
      const outOfStockProducts = products?.filter((p) => p.stock_quantity === 0).length || 0

      // Obtener estadísticas de clientes
      const { data: customers } = await supabase.from("customers").select("id")
      const totalCustomers = customers?.length || 0

      // Obtener estadísticas de ventas (del mes actual)
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { data: sales } = await supabase
        .from("sales")
        .select("total")
        .eq("status", "completada")
        .gte("created_at", startOfMonth.toISOString())

      const monthSales = sales?.reduce((sum, sale) => sum + sale.total, 0) || 0
      const monthSalesCount = sales?.length || 0

      // Obtener cotizaciones pendientes
      const { data: quotes } = await supabase.from("quotes").select("id, status").eq("status", "pendiente")
      const pendingQuotes = quotes?.length || 0

      // Obtener cotizaciones convertidas este mes
      const { data: convertedQuotesData } = await supabase
        .from("quotes")
        .select("id")
        .eq("status", "convertida")
        .gte("updated_at", startOfMonth.toISOString())
      const convertedQuotes = convertedQuotesData?.length || 0

      // Obtener movimientos de inventario de hoy
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)

      const { data: movements } = await supabase
        .from("inventory_movements")
        .select("id")
        .gte("created_at", startOfDay.toISOString())

      const todayMovements = movements?.length || 0

      // Obtener entradas y salidas de efectivo de hoy
      const { data: entries } = await supabase
        .from("cash_movements")
        .select("amount")
        .eq("type", "entrada")
        .gte("created_at", startOfDay.toISOString())

      const { data: exits } = await supabase
        .from("cash_movements")
        .select("amount")
        .eq("type", "salida")
        .gte("created_at", startOfDay.toISOString())

      const todayEntries = entries?.reduce((sum, entry) => sum + entry.amount, 0) || 0
      const todayExits = exits?.reduce((sum, exit) => sum + exit.amount, 0) || 0

      // Obtener ventas en efectivo de hoy
      const { data: cashSales } = await supabase
        .from("sales")
        .select("total")
        .eq("status", "completada")
        .eq("payment_method", "efectivo")
        .gte("created_at", startOfDay.toISOString())

      const todayCashSales = cashSales?.reduce((sum, sale) => sum + sale.total, 0) || 0
      const todayNetCash = todayCashSales + todayEntries - todayExits

      setStats({
        totalProducts,
        lowStockProducts,
        outOfStockProducts,
        totalCustomers,
        monthSales,
        monthSalesCount,
        pendingQuotes,
        convertedQuotes,
        todayMovements,
        todayEntries,
        todayExits,
        todayNetCash,
      })

      setLastUpdate(new Date())
    } catch (error) {
      console.error("Error fetching stats:", error)
    } finally {
      setStatsLoading(false)
    }
  }, [statsLoading])

  const handleDataUpdate = useCallback(() => {
    fetchStats()
  }, [fetchStats])

  const renderContent = () => {
    switch (activeTab) {
      case "products":
        return <ProductsManager />
      case "scanner":
        return <BarcodeScanner />
      case "inventory":
        return <InventoryManager />
      case "sales":
        return <SalesManager />
      case "quotes":
        return <QuotesManager />
      case "customers":
        return <CustomersManager />
      case "quick-entries":
        return <QuickEntries />
      case "quick-exits":
        return <QuickExits />
      case "settings":
        return <SettingsManager />
      default:
        return (
          <div className="space-y-6 p-2 md:p-6">
            {/* Header con botones de acción */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Última actualización: {lastUpdate.toLocaleTimeString("es-ES")}
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchStats} disabled={statsLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${statsLoading ? "animate-spin" : ""}`} />
                  {statsLoading ? "Actualizando..." : "Actualizar"}
                </Button>
              </div>
            </div>

            {/* Estadísticas principales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ventas del Mes</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold text-green-600">{formatCurrency(stats.monthSales)}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.monthSalesCount} {stats.monthSalesCount === 1 ? "venta" : "ventas"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Efectivo Hoy</CardTitle>
                  <DollarSign className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold text-blue-600">
                    {formatCurrency(stats.todayNetCash)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +{formatCurrency(stats.todayEntries)} / -{formatCurrency(stats.todayExits)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cotizaciones</CardTitle>
                  <FileText className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold text-yellow-600">{stats.pendingQuotes}</div>
                  <p className="text-xs text-muted-foreground">{stats.convertedQuotes} convertidas este mes</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Stock Crítico</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold text-red-600">{stats.outOfStockProducts}</div>
                  <p className="text-xs text-muted-foreground">{stats.lowStockProducts} con stock bajo</p>
                </CardContent>
              </Card>
            </div>

            {/* Gráfica de análisis */}
            <DashboardChart onDataUpdate={handleDataUpdate} />

            {/* Estadísticas secundarias */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold">{stats.totalProducts}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold">{stats.totalCustomers}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Promedio por Venta</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold">
                    {stats.monthSalesCount > 0
                      ? formatCurrency(stats.monthSales / stats.monthSalesCount)
                      : formatCurrency(0)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Información de bienvenida */}
            <Card>
              <CardHeader>
                <CardTitle>Bienvenido a H2R Punto de venta v1.0</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Sistema completo de gestión para tu taller. Administra productos, inventario, ventas y cotizaciones
                  desde una sola plataforma.
                </p>
              </CardContent>
            </Card>
          </div>
        )
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return <LoginForm />
  }

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </DashboardLayout>
  )
}
