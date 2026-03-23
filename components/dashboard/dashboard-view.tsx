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
  FileText as FileTextIcon,
  Calendar as CalendarIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { QuickMovementsWidget } from "./quick-movements-widget"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { useSettings } from "@/hooks/use-settings"
import { format, subDays, startOfDay, endOfDay, isSameDay } from "date-fns"
import { es } from "date-fns/locale"

interface DashboardViewProps {
  onDataUpdate?: () => void
}

export default function DashboardView({ onDataUpdate }: DashboardViewProps) {
  const { formatCurrency } = useSettings()
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [selectedStatDate, setSelectedStatDate] = useState<Date>(new Date())
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
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
      const startOfSelected = startOfDay(selectedStatDate)
      const endOfSelected = endOfDay(selectedStatDate)
      
      const previousDate = subDays(selectedStatDate, 1)
      const startOfPrevious = startOfDay(previousDate)
      const endOfPrevious = endOfDay(previousDate)

      // Peticiones en paralelo
      const [
        prodRes, 
        custRes, 
        selectedSalesRes, 
        previousSalesRes, 
        quotesRes, 
        previousQuotesRes, 
        selectedEntriesRes, 
        selectedExitsRes, 
        selectedCashSalesRes,
        previousEntriesRes,
        previousExitsRes,
        previousCashSalesRes
      ] = await Promise.all([
        supabase.from("products").select("stock_quantity, min_stock, cost, public_price, category"),
        supabase.from("customers").select("id"),
        supabase.from("sales")
          .select("total, cost_total, created_at")
          .eq("status", "completada")
          .gte("created_at", startOfSelected.toISOString())
          .lte("created_at", endOfSelected.toISOString()),
        supabase.from("sales")
          .select("total, created_at")
          .eq("status", "completada")
          .gte("created_at", startOfPrevious.toISOString())
          .lte("created_at", endOfPrevious.toISOString()),
        supabase.from("quotes").select("id, status, created_at").gte("created_at", startOfSelected.toISOString()).lte("created_at", endOfSelected.toISOString()),
        supabase.from("quotes").select("id, created_at").gte("created_at", startOfPrevious.toISOString()).lte("created_at", endOfPrevious.toISOString()),
        supabase.from("cash_movements").select("amount").eq("type", "entrada").gte("created_at", startOfSelected.toISOString()).lte("created_at", endOfSelected.toISOString()),
        supabase.from("cash_movements").select("amount").eq("type", "salida").gte("created_at", startOfSelected.toISOString()).lte("created_at", endOfSelected.toISOString()),
        supabase.from("cash_movements").select("amount").eq("type", "venta").gte("created_at", startOfSelected.toISOString()).lte("created_at", endOfSelected.toISOString()),
        supabase.from("cash_movements").select("amount").eq("type", "entrada").gte("created_at", startOfPrevious.toISOString()).lte("created_at", endOfPrevious.toISOString()),
        supabase.from("cash_movements").select("amount").eq("type", "salida").gte("created_at", startOfPrevious.toISOString()).lte("created_at", endOfPrevious.toISOString()),
        supabase.from("cash_movements").select("amount").eq("type", "venta").gte("created_at", startOfPrevious.toISOString()).lte("created_at", endOfPrevious.toISOString()),
      ])

      // Cálculos Ventas
      const selectedSales = selectedSalesRes.data?.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0) || 0
      const previousSales = previousSalesRes.data?.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0) || 0

      // Cálculos Efectivo
      const selectedEntries = (selectedEntriesRes.data?.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0) || 0) + 
                            (selectedCashSalesRes.data?.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0) || 0)
      const selectedExits = selectedExitsRes.data?.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0) || 0
      const selectedNetCash = selectedEntries - selectedExits

      const previousEntries = (previousEntriesRes.data?.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0) || 0) +
                             (previousCashSalesRes.data?.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0) || 0)
      const previousExits = previousExitsRes.data?.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0) || 0
      const previousNetCash = previousEntries - previousExits

      // Cálculos Cotizaciones
      const pendingQuotes = quotesRes.data?.filter(q => q.status === 'pendiente').length || 0
      const selectedQuotes = quotesRes.data?.length || 0
      const previousQuotes = previousQuotesRes.data?.length || 0

      // Margen Bruto
      const totalCost = selectedSalesRes.data?.reduce((acc, s) => acc + (parseFloat(s.cost_total) || 0), 0) || 0
      const grossMargin = selectedSales > 0 ? ((selectedSales - totalCost) / selectedSales) * 100 : 0
      const yesterdayGrossMargin = 0

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
        todaySales: selectedSales,
        yesterdaySales: previousSales,
        pendingQuotes,
        todayQuotes: selectedQuotes,
        yesterdayQuotes: previousQuotes,
        todayEntries: selectedEntries,
        todayExits: selectedExits,
        todayNetCash: selectedNetCash,
        yesterdayNetCash: previousNetCash,
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
  }, [selectedStatDate])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const isToday = isSameDay(selectedStatDate, new Date())
  const statLabel = isToday ? "del Día" : "de la Fecha"
  const comparisonLabel = isToday ? "vs ayer" : "vs anterior"

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2 mt-2">
           <div className="flex items-center gap-2 text-[#10b981] font-black text-sm uppercase tracking-[0.3em]">
             <LayoutDashboard className="h-5 w-5" />
             PANEL DE CONTROL
           </div>
           <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter leading-none">
             Dashboard General
           </h1>
           <p className="text-sm md:text-base font-bold text-slate-400">
             Resumen global y análisis de rendimiento operativo {isToday ? "de hoy" : "de la fecha"}.
           </p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 group transition-all hover:shadow-md">
          <div className="flex items-center gap-1">
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 px-4 rounded-xl font-bold text-slate-700 hover:bg-slate-50 gap-2 transition-all">
                  <CalendarIcon className="h-4 w-4 text-[#10b981]" />
                  <span className="text-[11px] uppercase tracking-wider">
                    {format(selectedStatDate, isToday ? "'Hoy,' dd MMM" : "dd MMM yyyy", { locale: es })}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-3xl shadow-2xl border-none overflow-hidden" align="end">
                <Calendar
                  mode="single"
                  selected={selectedStatDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedStatDate(date)
                      setIsCalendarOpen(false)
                    }
                  }}
                  initialFocus
                  className="rounded-3xl border-0 p-4"
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="h-6 w-px bg-slate-100 mx-1 hidden sm:block" />
          
          <div className="px-3 hidden sm:block">
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Update</p>
            <p className="text-[11px] font-black text-slate-500">{format(lastUpdate, "HH:mm")}</p>
          </div>

          <Button 
            onClick={onDataUpdate || fetchStats} 
            disabled={loading}
            size="icon"
            className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-200 transition-all active:scale-95 h-9 w-9"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </header>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          title={`Ventas ${statLabel}`}
          value={formatCurrency(stats.todaySales)}
          icon={DollarSign}
          trend={calculateTrend(stats.todaySales, stats.yesterdaySales)}
          trendLabel={comparisonLabel}
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
          title={`Efectivo ${statLabel}`}
          value={formatCurrency(stats.todayNetCash)}
          icon={ArrowUpRight}
          trend={calculateTrend(stats.todayNetCash, stats.yesterdayNetCash)}
          trendLabel={comparisonLabel}
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
          title={`Cotizaciones ${statLabel}`}
          value={stats.todayQuotes}
          icon={FileText}
          trend={calculateTrend(stats.todayQuotes, stats.yesterdayQuotes)}
          trendLabel={comparisonLabel}
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
          title={`Margen Bruto ${isToday ? "Hoy" : ""}`}
          value={`${stats.grossMargin.toFixed(1)}%`}
          icon={TrendingUp}
          trend={calculateTrend(stats.grossMargin, stats.yesterdayGrossMargin)}
          trendLabel={comparisonLabel}
          loading={loading}
          badge={{ 
            text: stats.grossMargin > 30 ? "Saludable" : "Bajo", 
            type: stats.grossMargin > 30 ? "success" : "warning" 
          }}
          footer={
            <div className="flex items-center gap-2 group cursor-pointer">
              <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 group-hover:bg-emerald-400 transition-colors" style={{ width: `${stats.grossMargin}%` }} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase">ANÁLISIS</span>
            </div>
          }
        />
      </div>

      {/* Main Analysis Section */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 md:gap-6">
        <div className="xl:col-span-3">
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardContent className="p-4 md:p-6 lg:p-8">
               <DashboardChart onDataUpdate={fetchStats} />
            </CardContent>
          </Card>
        </div>
        <div className="xl:col-span-1">
          <QuickMovementsWidget onUpdate={fetchStats} />
        </div>
      </div>

      {/* Row of Horizontal Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 pb-12 mt-6">
         <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white p-1.5 group cursor-pointer hover:shadow-lg transition-all duration-300">
           <div className="flex items-center gap-3 p-4 rounded-2xl group-hover:bg-slate-50 transition-colors">
              <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-600 transition-transform duration-500 group-hover:scale-110">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ítems del Catálogo</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{stats.totalProducts.toLocaleString()}</span>
                  <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">OK</span>
                </div>
              </div>
           </div>
         </Card>

         <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white p-1.5 group cursor-pointer hover:shadow-lg transition-all duration-300">
           <div className="flex items-center gap-3 p-4 rounded-2xl group-hover:bg-slate-50 transition-colors">
              <div className="p-3.5 rounded-xl bg-blue-50 text-blue-600 transition-transform duration-500 group-hover:scale-110">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Base de Clientes</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{stats.totalCustomers.toLocaleString()}</span>
                  <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">ACTIVOS</span>
                </div>
              </div>
           </div>
         </Card>

         <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white p-1.5 group cursor-pointer hover:shadow-lg transition-all duration-300">
           <div className="flex items-center gap-3 p-4 rounded-2xl group-hover:bg-slate-50 transition-colors">
              <div className="p-3.5 rounded-xl bg-amber-50 text-amber-600 transition-transform duration-500 group-hover:scale-110">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Top Categoría</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl md:text-2xl font-black text-slate-900 tracking-tight truncate max-w-[150px] inline-block">{stats.bestCategory}</span>
                  <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">LÍDER</span>
                </div>
              </div>
           </div>
         </Card>
      </div>
    </div>
  )
}
