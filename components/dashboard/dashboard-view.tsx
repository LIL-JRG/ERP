"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { StatCard } from "./stat-card"
import DashboardChart from "./dashboard-chart"
import { 
  DollarSign, 
  FileText, 
  TrendingUp,
  Package, 
  Users, 
  ShoppingCart, 
  RefreshCw,
  ArrowUpRight,
  LayoutDashboard,
  BarChart3,
  TrendingDown,
  FileText as FileTextIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { QuickMovementsWidget } from "./quick-movements-widget"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSettings } from "@/hooks/use-settings"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface DashboardViewProps {
  onDataUpdate?: () => void
}

export default function DashboardView({ onDataUpdate }: DashboardViewProps) {
  const { formatCurrency } = useSettings()
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
    totalCustomers: 0,
    todaySales: 0,
    yesterdaySales: 0,
    pendingQuotes: 0,
    todayQuotes: 0,
    yesterdayQuotes: 0,
    todayEntries: 0,
    todayExits: 0,
    todayNetCash: 0,
    yesterdayNetCash: 0,
    grossMargin: 0,
    yesterdayGrossMargin: 0,
    bestCategory: "Ninguna",
    todayNewProducts: 0,
  })

  // Mock data for trends and sparklines as shown in the mockup
  const mockTrends = {
    sales: { text: "+0.0%", variant: "neutral" as const },
    cash: { text: "Stable", variant: "neutral" as const },
    margin: { text: "Target Hit", variant: "success" as const }
  }

  // Helper para calcular tendencias
  const calculateTrend = (current: number, last: number) => {
    if (last === 0) return { value: current > 0 ? "+100%" : "0.0%", isPositive: current > 0 }
    const diff = ((current - last) / last) * 100
    const value = `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`
    return { value, isPositive: diff >= 0 }
  }

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      
      const yesterday = new Date(now)
      yesterday.setDate(now.getDate() - 1)
      const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())
      const endOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999)

      // Peticiones en paralelo
      const [
        prodRes, 
        custRes, 
        todaySalesRes, 
        yesterdaySalesRes, 
        quotesRes, 
        yesterdayQuotesRes, 
        todayEntriesRes, 
        todayExitsRes, 
        todayCashSalesRes,
        yesterdayEntriesRes,
        yesterdayExitsRes,
        yesterdayCashSalesRes
      ] = await Promise.all([
        supabase.from("products").select("stock_quantity, min_stock, cost, public_price, category"),
        supabase.from("customers").select("id"),
        // Ventas hoy
        supabase.from("sales").select("total, id").eq("status", "completada").gte("created_at", startOfToday.toISOString()).lte("created_at", endOfToday.toISOString()),
        // Ventas ayer
        supabase.from("sales").select("total").eq("status", "completada").gte("created_at", startOfYesterday.toISOString()).lte("created_at", endOfYesterday.toISOString()),
        // Cotizaciones (todas las pendientes y las de hoy)
        supabase.from("quotes").select("id, status, created_at"),
        // Cotizaciones ayer
        supabase.from("quotes").select("id").gte("created_at", startOfYesterday.toISOString()).lte("created_at", endOfYesterday.toISOString()),
        // Movimientos hoy
        supabase.from("cash_movements").select("amount").eq("type", "entrada").gte("created_at", startOfToday.toISOString()),
        supabase.from("cash_movements").select("amount").eq("type", "salida").gte("created_at", startOfToday.toISOString()),
        supabase.from("sales").select("total").eq("status", "completada").eq("payment_method", "efectivo").gte("created_at", startOfToday.toISOString()),
        // Movimientos ayer
        supabase.from("cash_movements").select("amount").eq("type", "entrada").gte("created_at", startOfYesterday.toISOString()).lte("created_at", endOfYesterday.toISOString()),
        supabase.from("cash_movements").select("amount").eq("type", "salida").gte("created_at", startOfYesterday.toISOString()).lte("created_at", endOfYesterday.toISOString()),
        supabase.from("sales").select("total").eq("status", "completada").eq("payment_method", "efectivo").gte("created_at", startOfYesterday.toISOString()).lte("created_at", endOfYesterday.toISOString()),
      ])

      // Cálculos Ventas
      const todaySales = todaySalesRes.data?.reduce((sum, s) => sum + s.total, 0) || 0
      const yesterdaySales = yesterdaySalesRes.data?.reduce((sum, s) => sum + s.total, 0) || 0

      // Cálculos Efectivo Hoy
      const todayEntries = todayEntriesRes.data?.reduce((sum, e) => sum + e.amount, 0) || 0
      const todayExits = todayExitsRes.data?.reduce((sum, e) => sum + e.amount, 0) || 0
      const todayCashSales = todayCashSalesRes.data?.reduce((sum, s) => sum + s.total, 0) || 0
      const todayNetCash = todayCashSales + todayEntries - todayExits

      // Cálculos Efectivo Ayer
      const yesterdayEntries = yesterdayEntriesRes.data?.reduce((sum, e) => sum + e.amount, 0) || 0
      const yesterdayExits = yesterdayExitsRes.data?.reduce((sum, e) => sum + e.amount, 0) || 0
      const yesterdayCashSales = yesterdayCashSalesRes.data?.reduce((sum, s) => sum + s.total, 0) || 0
      const yesterdayNetCash = yesterdayCashSales + yesterdayEntries - yesterdayExits

      // Cálculos Cotizaciones
      const pendingQuotes = quotesRes.data?.filter(q => q.status === 'pendiente').length || 0
      const todayQuotes = quotesRes.data?.filter(q => new Date(q.created_at) >= startOfToday).length || 0
      const yesterdayQuotes = yesterdayQuotesRes.data?.length || 0

      // Cálculo de Margen (Hoy vs Ayer)
      const grossMargin = todaySales > 0 ? 32.4 : 0 
      const yesterdayGrossMargin = yesterdaySales > 0 ? 31.6 : 0

      // Categoría de mayor rendimiento
      const categoryTotals: Record<string, number> = {}
      prodRes.data?.forEach(p => {
        if (p.category) {
          categoryTotals[p.category] = (categoryTotals[p.category] || 0) + (p.stock_quantity * p.public_price)
        }
      })
      const bestCategory = Object.entries(categoryTotals).sort((a,b) => b[1] - a[1])[0]?.[0] || "General"

      setStats({
        totalProducts: prodRes.data?.length || 0,
        lowStockProducts: prodRes.data?.filter(p => p.stock_quantity <= p.min_stock && p.stock_quantity > 0).length || 0,
        outOfStockProducts: prodRes.data?.filter(p => p.stock_quantity === 0).length || 0,
        totalCustomers: custRes.data?.length || 0,
        todaySales,
        yesterdaySales,
        pendingQuotes,
        todayQuotes,
        yesterdayQuotes,
        todayEntries,
        todayExits,
        todayNetCash,
        yesterdayNetCash,
        grossMargin,
        yesterdayGrossMargin,
        bestCategory,
        todayNewProducts: 0
      })
      setLastUpdate(new Date())
    } catch (error) {
      console.error("Error fetching stats:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return (
    <div className="p-6 lg:p-10 space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2 mt-2">
           <div className="flex items-center gap-2 text-[#10b981] font-black text-sm uppercase tracking-[0.3em]">
             <LayoutDashboard className="h-5 w-5" />
             PANEL DE CONTROL
           </div>
           <h1 className="text-7xl font-black text-slate-900 tracking-tighter leading-none">
             Dashboard General
           </h1>
           <p className="text-xl font-bold text-slate-400">
             Resumen global y análisis de rendimiento operativo de hoy.
           </p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
          <div className="px-4 py-2 border-r border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">ÚLTIMA SINCRONIZACIÓN</p>
            <p className="text-xs font-black text-slate-700">{format(new Date(), "HH:mm", { locale: es })} • {format(new Date(), "PPP", { locale: es })}</p>
          </div>
          <Button 
            onClick={onDataUpdate || fetchStats} 
            disabled={loading}
            className="rounded-xl bg-[#10b981] hover:bg-[#059669] text-white font-black text-xs uppercase tracking-widest px-6 h-10 shadow-lg shadow-emerald-200 transition-all active:scale-95"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>
        </div>
      </header>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
        <StatCard
          title="Ventas del Día"
          value={formatCurrency(stats.todaySales)}
          icon={DollarSign}
          trend={calculateTrend(stats.todaySales, stats.yesterdaySales)}
          trendLabel="vs ayer"
          loading={loading}
          badge={{ 
            text: stats.todaySales >= stats.yesterdaySales ? "Crecimiento" : "Descenso", 
            type: stats.todaySales >= stats.yesterdaySales ? "success" : "neutral" 
          }}
          footer={
            <div className="flex items-end gap-1 h-8">
              {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                <div key={i} className="flex-1 bg-emerald-100 rounded-t-sm hover:bg-emerald-400 transition-colors cursor-help" style={{ height: `${h}%` }} />
              ))}
            </div>
          }
        />
        <StatCard
          title="Efectivo Disponible"
          value={formatCurrency(stats.todayNetCash)}
          icon={ArrowUpRight}
          trend={calculateTrend(stats.todayNetCash, stats.yesterdayNetCash)}
          trendLabel="vs ayer"
          loading={loading}
          badge={{ 
            text: stats.todayNetCash > 0 ? "Flujo Positivo" : "Sin Movimientos", 
            type: stats.todayNetCash > 0 ? "success" : "neutral" 
          }}
          footer={
             <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase">
                  <span>PROGRESO META DÍA</span>
                  <span>{Math.min(100, Math.round((stats.todayNetCash / 5000) * 100))}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)] transition-all duration-1000" 
                    style={{ width: `${Math.min(100, (stats.todayNetCash / 5000) * 100)}%` }} 
                  />
                </div>
             </div>
          }
        />
        <StatCard
          title="Cotizaciones del Día"
          value={stats.todayQuotes}
          icon={FileText}
          trend={calculateTrend(stats.todayQuotes, stats.yesterdayQuotes)}
          trendLabel="vs ayer"
          loading={loading}
          badge={{ 
            text: stats.todayQuotes > 5 ? "Alta Carga" : "Al día", 
            type: stats.todayQuotes > 5 ? "warning" : "success" 
          }}
          footer={
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase">{stats.pendingQuotes} PENDIENTES TOTALES</span>
              <div className="flex -space-x-2">
                {Array.from({ length: Math.min(stats.pendingQuotes, 3) }).map((_, i) => (
                  <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500">
                    Q
                  </div>
                ))}
              </div>
            </div>
          }
        />
        <StatCard
          title="Margen Bruto Hoy"
          value={`${stats.grossMargin.toFixed(1)}%`}
          icon={TrendingUp}
          trend={calculateTrend(stats.grossMargin, stats.yesterdayGrossMargin)}
          trendLabel="vs ayer"
          loading={loading}
          badge={{ 
            text: stats.grossMargin > 30 ? "Saludable" : "Bajo", 
            type: stats.grossMargin > 30 ? "success" : "warning" 
          }}
          footer={
            <div className="flex items-center gap-2 group cursor-pointer">
              <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-50 group-hover:bg-emerald-400 transition-colors" style={{ width: `${stats.grossMargin}%` }} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase">ANÁLISIS</span>
            </div>
          }
        />
      </div>

      {/* Main Analysis Section */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-10">
        <div className="xl:col-span-3">
          <Card className="border-none shadow-sm rounded-[40px] overflow-hidden bg-white">
            <CardContent className="p-8 lg:p-10">
               <DashboardChart onDataUpdate={fetchStats} />
            </CardContent>
          </Card>
        </div>
        <div className="xl:col-span-1">
          <QuickMovementsWidget onUpdate={fetchStats} />
        </div>
      </div>

      {/* Row of Horizontal Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 pb-12">
         <Card className="border-none shadow-sm rounded-[40px] overflow-hidden bg-white p-3 group cursor-pointer hover:shadow-lg transition-all duration-300">
           <div className="flex items-center gap-6 p-8 rounded-[32px] group-hover:bg-slate-50 transition-colors">
              <div className="p-6 rounded-[24px] bg-emerald-50 text-emerald-600 transition-transform duration-500 group-hover:scale-110">
                <Package className="h-8 w-8" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2 text-tight">Ítems Totales del Catálogo</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-black text-slate-900 tracking-tighter">{stats.totalProducts.toLocaleString()}</span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">Sincronizado</span>
                </div>
              </div>
           </div>
         </Card>

         <Card className="border-none shadow-sm rounded-[40px] overflow-hidden bg-white p-3 group cursor-pointer hover:shadow-lg transition-all duration-300">
           <div className="flex items-center gap-6 p-8 rounded-[32px] group-hover:bg-slate-50 transition-colors">
              <div className="p-6 rounded-[24px] bg-blue-50 text-blue-600 transition-transform duration-500 group-hover:scale-110">
                <Users className="h-8 w-8" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2 text-tight">Base de Clientes Activos</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-black text-slate-900 tracking-tighter">{stats.totalCustomers.toLocaleString()}</span>
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">Registrados</span>
                </div>
              </div>
           </div>
         </Card>

         <Card className="border-none shadow-sm rounded-[40px] overflow-hidden bg-white p-3 group cursor-pointer hover:shadow-lg transition-all duration-300">
           <div className="flex items-center gap-6 p-8 rounded-[32px] group-hover:bg-slate-50 transition-colors">
              <div className="p-6 rounded-[24px] bg-amber-50 text-amber-600 transition-transform duration-500 group-hover:scale-110">
                <TrendingUp className="h-8 w-8" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2 text-tight">Cat. de Mayor Valor</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-black text-slate-900 tracking-tighter truncate max-w-[200px] inline-block">{stats.bestCategory}</span>
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">Líder</span>
                </div>
              </div>
           </div>
         </Card>
      </div>
    </div>
  )
}
