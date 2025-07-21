"use client"

import { useState, useEffect } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts"
import { useSettings } from "@/hooks/use-settings"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon, BarChart3, LineChartIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import React from "react"
import { Checkbox } from "@/components/ui/checkbox"

interface ChartData {
  date: string
  ventas: number
  cotizaciones: number
  ventasCount: number
  cotizacionesCount: number
  displayDate: string
  // Nuevas métricas
  ingresos_mensuales: number
  tasa_conversion: number
  promedio_ticket: number
  tendencia_crecimiento: number
  eficiencia_ventas: number
  margen_ganancia: number
}

interface DashboardChartProps {
  onDataUpdate?: () => void
}

// Series disponibles para mostrar en la gráfica
const AVAILABLE_SERIES = [
  { key: "ventas", label: "Ventas", color: "#10b981" },
  { key: "cotizaciones", label: "Cotizaciones", color: "#f59e0b" },
  { key: "ingresos_mensuales", label: "Ingresos Mensuales", color: "#3b82f6" },
  { key: "tasa_conversion", label: "Tasa de Conversión (%)", color: "#8b5cf6" },
  { key: "promedio_ticket", label: "Promedio por Ticket", color: "#ef4444" },
  { key: "tendencia_crecimiento", label: "Tendencia de Crecimiento (%)", color: "#06b6d4" },
  { key: "eficiencia_ventas", label: "Eficiencia de Ventas", color: "#84cc16" },
  { key: "margen_ganancia", label: "Margen de Ganancia (%)", color: "#f97316" },
]

export default function DashboardChart({ onDataUpdate }: DashboardChartProps) {
  const { formatCurrency } = useSettings()
  const [chartType, setChartType] = useState<"amount" | "count">("amount")
  const [viewType, setViewType] = useState<"bar" | "line">("bar")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dateRange, setDateRange] = useState<"day" | "week" | "month">("week")
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  // Estado para las series seleccionadas
  const [selectedSeries, setSelectedSeries] = useState<string[]>([])

  // --- Persistencia en localStorage ---
  // Clave para localStorage
  const STORAGE_KEY = "dashboardChartConfig"

  // Estado para controlar si ya se cargó la configuración inicial
  const [configLoaded, setConfigLoaded] = useState(false)

  // Cargar configuración al montar
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        console.log("Cargando configuración guardada:", parsed)
        
        // Cargar todas las configuraciones guardadas
        if (parsed.chartType) setChartType(parsed.chartType)
        if (parsed.viewType) setViewType(parsed.viewType)
        if (parsed.dateRange) setDateRange(parsed.dateRange)
        if (parsed.selectedDate) setSelectedDate(new Date(parsed.selectedDate))
        
        // Cargar series seleccionadas
        if (parsed.selectedSeries && parsed.selectedSeries.length > 0) {
          setSelectedSeries(parsed.selectedSeries)
        } else {
          setSelectedSeries(["ventas", "cotizaciones"])
        }
      } catch (error) {
        console.error("Error al cargar configuración:", error)
        // En caso de error, usar valores por defecto
        setSelectedSeries(["ventas", "cotizaciones"])
      }
    } else {
      console.log("No hay configuración guardada, usando valores por defecto")
      setSelectedSeries(["ventas", "cotizaciones"])
    }
    setConfigLoaded(true)
  }, [])

  // Guardar configuración cuando cambie (solo después de cargar la configuración inicial)
  useEffect(() => {
    if (configLoaded) {
      const configToSave = {
        chartType,
        viewType,
        dateRange,
        selectedSeries,
        selectedDate: selectedDate.toISOString(),
      }
      console.log("Guardando configuración:", configToSave)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(configToSave))
    }
  }, [chartType, viewType, dateRange, selectedSeries, selectedDate, configLoaded])
  // --- Fin persistencia ---

  useEffect(() => {
    fetchChartData()
  }, [selectedDate, dateRange])

  const fetchChartData = async () => {
    setLoading(true)
    setError(null)

    try {
      const { startDate, endDate, dataPoints } = getDateRange()

      console.log("Fetching data from", startDate.toISOString(), "to", endDate.toISOString())

      // Obtener datos de ventas
      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select("total, created_at, sale_type")
        .eq("status", "completada")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())

      if (salesError) {
        console.error("Error fetching sales:", salesError)
      }

      // Obtener datos de cotizaciones
      const { data: quotesData, error: quotesError } = await supabase
        .from("quotes")
        .select("total, created_at, status")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())

      if (quotesError) {
        console.error("Error fetching quotes:", quotesError)
      }

      // Obtener datos de productos para calcular márgenes
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("price, cost")

      if (productsError) {
        console.error("Error fetching products:", productsError)
      }

      // Obtener datos históricos para proyecciones
      const historicalStartDate = new Date(startDate)
      historicalStartDate.setMonth(historicalStartDate.getMonth() - 3) // 3 meses atrás

      const { data: historicalSalesData, error: historicalError } = await supabase
        .from("sales")
        .select("total, created_at")
        .eq("status", "completada")
        .gte("created_at", historicalStartDate.toISOString())
        .lte("created_at", startDate.toISOString())

      if (historicalError) {
        console.error("Error fetching historical sales:", historicalError)
      }

      console.log("Sales data:", salesData?.length || 0, "records")
      console.log("Quotes data:", quotesData?.length || 0, "records")

      // Procesar datos según el rango
      const processedData = processDataByRange(
        dataPoints, 
        salesData || [], 
        quotesData || [], 
        productsData || [],
        historicalSalesData || []
      )

      console.log("Processed data:", processedData)

      // Si no hay datos reales, mostrar mensaje de no hay registros
      if (processedData.every((item) => item.ventas === 0 && item.cotizaciones === 0)) {
        console.log("No real data found, showing empty state")
        setChartData([])
      } else {
        setChartData(processedData)
      }
    } catch (error) {
      console.error("Error fetching chart data:", error)
      setError("Error al cargar los datos del gráfico")
      setChartData(generateDemoData())
    } finally {
      setLoading(false)
    }
  }

  const getDateRange = () => {
    const endDate = new Date(selectedDate)
    const startDate = new Date(selectedDate)
    const dataPoints: Date[] = []

    switch (dateRange) {
      case "day":
        // Mostrar las últimas 24 horas por horas
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)
        for (let i = 0; i < 24; i++) {
          const point = new Date(startDate)
          point.setHours(i)
          dataPoints.push(point)
        }
        break
      case "week":
        // Mostrar los últimos 7 días
        startDate.setDate(selectedDate.getDate() - 6)
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)
        for (let i = 0; i < 7; i++) {
          const point = new Date(startDate)
          point.setDate(startDate.getDate() + i)
          dataPoints.push(point)
        }
        break
      case "month":
        // Mostrar los últimos 30 días
        startDate.setDate(selectedDate.getDate() - 29)
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)
        for (let i = 0; i < 30; i++) {
          const point = new Date(startDate)
          point.setDate(startDate.getDate() + i)
          dataPoints.push(point)
        }
        break
    }

    return { startDate, endDate, dataPoints }
  }

  const processDataByRange = (
    dataPoints: Date[], 
    salesData: any[], 
    quotesData: any[], 
    productsData: any[],
    historicalSalesData: any[]
  ): ChartData[] => {
    // Calcular métricas globales para proyecciones
    const avgMargin = calculateAverageMargin(productsData)
    const historicalTrend = calculateHistoricalTrend(historicalSalesData)
    
    return dataPoints.map((point) => {
      let displayDate = ""
      let startTime: Date
      let endTime: Date

      if (dateRange === "day") {
        // Por horas
        displayDate = format(point, "HH:mm", { locale: es })
        startTime = new Date(point)
        endTime = new Date(point)
        endTime.setHours(point.getHours() + 1)
      } else {
        // Por días
        displayDate = format(point, "dd/MM", { locale: es })
        startTime = new Date(point)
        startTime.setHours(0, 0, 0, 0)
        endTime = new Date(point)
        endTime.setHours(23, 59, 59, 999)
      }

      // Filtrar ventas para este período
      const periodSales = salesData.filter((sale) => {
        const saleDate = new Date(sale.created_at)
        return saleDate >= startTime && saleDate <= endTime
      })

      // Filtrar cotizaciones para este período
      const periodQuotes = quotesData.filter((quote) => {
        const quoteDate = new Date(quote.created_at)
        return quoteDate >= startTime && quoteDate <= endTime
      })

      // Calcular métricas básicas
      const ventas = periodSales.reduce((sum, sale) => sum + (sale.total || 0), 0)
      const cotizaciones = periodQuotes.reduce((sum, quote) => sum + (quote.total || 0), 0)
      const ventasCount = periodSales.length
      const cotizacionesCount = periodQuotes.length

      // Calcular métricas avanzadas
      const ingresos_mensuales = calculateMonthlyRevenue(point, salesData, historicalTrend)
      const tasa_conversion = calculateConversionRate(periodQuotes, periodSales)
      const promedio_ticket = ventasCount > 0 ? ventas / ventasCount : 0
      const tendencia_crecimiento = calculateGrowthTrend(point, salesData, historicalSalesData)
      const eficiencia_ventas = calculateSalesEfficiency(periodSales, periodQuotes)
      const margen_ganancia = calculateProfitMargin(ventas, avgMargin)

      return {
        date: point.toISOString(),
        displayDate,
        ventas,
        cotizaciones,
        ventasCount,
        cotizacionesCount,
        ingresos_mensuales,
        tasa_conversion,
        promedio_ticket,
        tendencia_crecimiento,
        eficiencia_ventas,
        margen_ganancia,
      }
    })
  }

  // Función para calcular margen promedio de productos
  const calculateAverageMargin = (products: any[]): number => {
    if (!products || products.length === 0) return 0.3 // Margen por defecto del 30%
    
    const margins = products
      .filter(p => p.price > 0 && p.cost > 0)
      .map(p => (p.price - p.cost) / p.price)
    
    return margins.length > 0 ? margins.reduce((sum, margin) => sum + margin, 0) / margins.length : 0.3
  }

  // Función para calcular tendencia histórica
  const calculateHistoricalTrend = (historicalSales: any[]): number => {
    if (!historicalSales || historicalSales.length < 2) return 0
    
    const monthlyTotals = new Map<string, number>()
    
    historicalSales.forEach(sale => {
      const month = new Date(sale.created_at).toISOString().slice(0, 7) // YYYY-MM
      monthlyTotals.set(month, (monthlyTotals.get(month) || 0) + sale.total)
    })
    
    const months = Array.from(monthlyTotals.keys()).sort()
    if (months.length < 2) return 0
    
    const firstMonth = monthlyTotals.get(months[0]) || 0
    const lastMonth = monthlyTotals.get(months[months.length - 1]) || 0
    
    return firstMonth > 0 ? ((lastMonth - firstMonth) / firstMonth) * 100 : 0
  }

  // Función para calcular ingresos mensuales proyectados
  const calculateMonthlyRevenue = (point: Date, salesData: any[], historicalTrend: number): number => {
    const currentMonth = new Date(point.getFullYear(), point.getMonth(), 1)
    const nextMonth = new Date(point.getFullYear(), point.getMonth() + 1, 1)
    
    const currentMonthSales = salesData.filter(sale => {
      const saleDate = new Date(sale.created_at)
      return saleDate >= currentMonth && saleDate < nextMonth
    })
    
    const currentMonthRevenue = currentMonthSales.reduce((sum, sale) => sum + sale.total, 0)
    
    // Proyección basada en tendencia histórica y días transcurridos
    const daysInMonth = new Date(point.getFullYear(), point.getMonth() + 1, 0).getDate()
    const daysElapsed = point.getDate()
    const completionRate = daysElapsed / daysInMonth
    
    if (completionRate > 0) {
      const projectedRevenue = currentMonthRevenue / completionRate
      const trendAdjustment = 1 + (historicalTrend / 100)
      return projectedRevenue * trendAdjustment
    }
    
    return currentMonthRevenue
  }

  // Función para calcular tasa de conversión
  const calculateConversionRate = (quotes: any[], sales: any[]): number => {
    if (quotes.length === 0) return 0
    
    // Contar cotizaciones convertidas (que tienen ventas asociadas)
    const convertedQuotes = quotes.filter(quote => 
      sales.some(sale => sale.quote_id === quote.id)
    ).length
    
    return (convertedQuotes / quotes.length) * 100
  }

  // Función para calcular tendencia de crecimiento
  const calculateGrowthTrend = (point: Date, currentSales: any[], historicalSales: any[]): number => {
    const currentPeriod = new Date(point.getFullYear(), point.getMonth(), 1)
    const previousPeriod = new Date(point.getFullYear(), point.getMonth() - 1, 1)
    
    const currentPeriodSales = currentSales.filter(sale => {
      const saleDate = new Date(sale.created_at)
      return saleDate >= currentPeriod && saleDate < point
    })
    
    const previousPeriodSales = historicalSales.filter(sale => {
      const saleDate = new Date(sale.created_at)
      return saleDate >= previousPeriod && saleDate < currentPeriod
    })
    
    const currentTotal = currentPeriodSales.reduce((sum, sale) => sum + sale.total, 0)
    const previousTotal = previousPeriodSales.reduce((sum, sale) => sum + sale.total, 0)
    
    return previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0
  }

  // Función para calcular eficiencia de ventas
  const calculateSalesEfficiency = (sales: any[], quotes: any[]): number => {
    if (quotes.length === 0) return 0
    
    const totalQuotesValue = quotes.reduce((sum, quote) => sum + quote.total, 0)
    const totalSalesValue = sales.reduce((sum, sale) => sum + sale.total, 0)
    
    return totalQuotesValue > 0 ? (totalSalesValue / totalQuotesValue) * 100 : 0
  }

  // Función para calcular margen de ganancia
  const calculateProfitMargin = (revenue: number, avgMargin: number): number => {
    return revenue * avgMargin
  }

  const generateDemoData = (): ChartData[] => {
    const { dataPoints } = getDateRange()
    return dataPoints.map((point, index) => {
      let displayDate = ""
      if (dateRange === "day") {
        displayDate = format(point, "HH:mm", { locale: es })
      } else {
        displayDate = format(point, "dd/MM", { locale: es })
      }

      const ventas = Math.floor(Math.random() * 2000) + 500
      const cotizaciones = Math.floor(Math.random() * 3000) + 1000
      const ventasCount = Math.floor(Math.random() * 5) + 1
      const cotizacionesCount = Math.floor(Math.random() * 8) + 2

      return {
        date: point.toISOString(),
        displayDate,
        ventas,
        cotizaciones,
        ventasCount,
        cotizacionesCount,
        ingresos_mensuales: Math.floor(Math.random() * 50000) + 15000,
        tasa_conversion: Math.floor(Math.random() * 40) + 20,
        promedio_ticket: Math.floor(Math.random() * 200) + 100,
        tendencia_crecimiento: Math.floor(Math.random() * 20) - 5,
        eficiencia_ventas: Math.floor(Math.random() * 30) + 60,
        margen_ganancia: Math.floor(Math.random() * 15) + 20,
      }
    })
  }

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(selectedDate)

    switch (dateRange) {
      case "day":
        newDate.setDate(selectedDate.getDate() + (direction === "next" ? 1 : -1))
        break
      case "week":
        newDate.setDate(selectedDate.getDate() + (direction === "next" ? 7 : -7))
        break
      case "month":
        newDate.setMonth(selectedDate.getMonth() + (direction === "next" ? 1 : -1))
        break
    }

    setSelectedDate(newDate)
  }

  const formatTooltipValue = (value: number, name: string) => {
    if (chartType === "amount") {
      return [formatCurrency(value), name === "ventas" ? "Ventas" : "Cotizaciones"]
    } else {
      return [value, name === "ventas" ? "Ventas" : "Cotizaciones"]
    }
  }

  // Tooltip personalizado para mostrar nombres y colores correctos
  interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{
      color: string;
      name: string;
      value: number;
    }>;
    label?: string;
  }

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (!active || !payload || payload.length === 0) return null;
    
    const formatValue = (name: string, value: number) => {
      // Métricas que deben mostrarse como porcentaje
      const percentageMetrics = ["tasa_conversion", "tendencia_crecimiento", "eficiencia_ventas", "margen_ganancia"]
      const isPercentage = percentageMetrics.some(metric => name.toLowerCase().includes(metric.replace('_', '')))
      
      // Métricas que deben mostrarse como moneda
      const currencyMetrics = ["ventas", "cotizaciones", "ingresos_mensuales", "promedio_ticket"]
      const isCurrency = currencyMetrics.some(metric => name.toLowerCase().includes(metric.replace('_', '')))
      
      if (isPercentage) {
        return `${value.toFixed(1)}%`
      } else if (isCurrency) {
        return formatCurrency(value)
      } else {
        return value.toString()
      }
    }
    
    return (
      <div className="bg-white p-2 rounded shadow text-xs border border-gray-200">
        <div className="font-semibold mb-1">{label}</div>
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                backgroundColor: entry.color,
                borderRadius: "50%",
              }}
            />
            <span>
              {entry.name}: {formatValue(entry.name, entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Procesar datos según series seleccionadas
  const processedData = chartData.map((item) => {
    const obj: any = { displayDate: item.displayDate }
    
    if (selectedSeries.includes("ventas")) {
      obj["ventas"] = chartType === "amount" ? item.ventas : item.ventasCount
    }
    if (selectedSeries.includes("cotizaciones")) {
      obj["cotizaciones"] = chartType === "amount" ? item.cotizaciones : item.cotizacionesCount
    }
    if (selectedSeries.includes("ingresos_mensuales")) {
      obj["ingresos_mensuales"] = item.ingresos_mensuales
    }
    if (selectedSeries.includes("tasa_conversion")) {
      obj["tasa_conversion"] = item.tasa_conversion
    }
    if (selectedSeries.includes("promedio_ticket")) {
      obj["promedio_ticket"] = item.promedio_ticket
    }
    if (selectedSeries.includes("tendencia_crecimiento")) {
      obj["tendencia_crecimiento"] = item.tendencia_crecimiento
    }
    if (selectedSeries.includes("eficiencia_ventas")) {
      obj["eficiencia_ventas"] = item.eficiencia_ventas
    }
    if (selectedSeries.includes("margen_ganancia")) {
      obj["margen_ganancia"] = item.margen_ganancia
    }
    
    return obj
  })

  // Renderizar la gráfica según las series seleccionadas
  const renderChart = () => {
    const commonProps = {
      data: processedData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    }
    if (viewType === "bar") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="displayDate" />
            <YAxis tickFormatter={chartType === "amount" ? (value) => `$${value}` : undefined} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {selectedSeries.includes("ventas") && (
              <Bar dataKey="ventas" fill="#10b981" name="Ventas" />
            )}
            {selectedSeries.includes("cotizaciones") && (
              <Bar dataKey="cotizaciones" fill="#f59e0b" name="Cotizaciones" />
            )}
            {selectedSeries.includes("ingresos_mensuales") && (
              <Bar dataKey="ingresos_mensuales" fill="#3b82f6" name="Ingresos Mensuales" />
            )}
            {selectedSeries.includes("tasa_conversion") && (
              <Bar dataKey="tasa_conversion" fill="#8b5cf6" name="Tasa de Conversión (%)" />
            )}
            {selectedSeries.includes("promedio_ticket") && (
              <Bar dataKey="promedio_ticket" fill="#ef4444" name="Promedio por Ticket" />
            )}
            {selectedSeries.includes("tendencia_crecimiento") && (
              <Bar dataKey="tendencia_crecimiento" fill="#06b6d4" name="Tendencia de Crecimiento (%)" />
            )}
            {selectedSeries.includes("eficiencia_ventas") && (
              <Bar dataKey="eficiencia_ventas" fill="#84cc16" name="Eficiencia de Ventas" />
            )}
            {selectedSeries.includes("margen_ganancia") && (
              <Bar dataKey="margen_ganancia" fill="#f97316" name="Margen de Ganancia (%)" />
            )}
          </BarChart>
        </ResponsiveContainer>
      )
    } else {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="displayDate" />
            <YAxis tickFormatter={chartType === "amount" ? (value) => `$${value}` : undefined} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {selectedSeries.includes("ventas") && (
              <Line type="monotone" dataKey="ventas" stroke="#10b981" strokeWidth={2} name="Ventas" />
            )}
            {selectedSeries.includes("cotizaciones") && (
              <Line type="monotone" dataKey="cotizaciones" stroke="#f59e0b" strokeWidth={2} name="Cotizaciones" />
            )}
            {selectedSeries.includes("ingresos_mensuales") && (
              <Line type="monotone" dataKey="ingresos_mensuales" stroke="#3b82f6" strokeWidth={2} name="Ingresos Mensuales" />
            )}
            {selectedSeries.includes("tasa_conversion") && (
              <Line type="monotone" dataKey="tasa_conversion" stroke="#8b5cf6" strokeWidth={2} name="Tasa de Conversión (%)" />
            )}
            {selectedSeries.includes("promedio_ticket") && (
              <Line type="monotone" dataKey="promedio_ticket" stroke="#ef4444" strokeWidth={2} name="Promedio por Ticket" />
            )}
            {selectedSeries.includes("tendencia_crecimiento") && (
              <Line type="monotone" dataKey="tendencia_crecimiento" stroke="#06b6d4" strokeWidth={2} name="Tendencia de Crecimiento (%)" />
            )}
            {selectedSeries.includes("eficiencia_ventas") && (
              <Line type="monotone" dataKey="eficiencia_ventas" stroke="#84cc16" strokeWidth={2} name="Eficiencia de Ventas" />
            )}
            {selectedSeries.includes("margen_ganancia") && (
              <Line type="monotone" dataKey="margen_ganancia" stroke="#f97316" strokeWidth={2} name="Margen de Ganancia (%)" />
            )}
          </LineChart>
        </ResponsiveContainer>
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Análisis de Ventas y Cotizaciones
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {/* Navegación de fechas */}
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => navigateDate("prev")}> <ChevronLeft className="h-4 w-4" /> </Button>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-[140px] bg-transparent">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(selectedDate, "dd/MM/yyyy", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center" side="bottom" sideOffset={4}>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(date)
                        setIsCalendarOpen(false)
                      }
                    }}
                    initialFocus
                    className="rounded-md border-0"
                    classNames={{
                      months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                      month: "space-y-4",
                      caption: "flex justify-center pt-1 relative items-center",
                      caption_label: "text-sm font-medium",
                      nav: "space-x-1 flex items-center",
                      nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                      nav_button_previous: "absolute left-1",
                      nav_button_next: "absolute right-1",
                      table: "w-full border-collapse space-y-1",
                      head_row: "flex",
                      head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
                      row: "flex w-full mt-2",
                      cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                      day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100",
                      day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                      day_today: "bg-accent text-accent-foreground",
                      day_outside: "text-muted-foreground opacity-50",
                      day_disabled: "text-muted-foreground opacity-50",
                      day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                      day_hidden: "invisible",
                    }}
                  />
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="sm" onClick={() => navigateDate("next")}> <ChevronRight className="h-4 w-4" /> </Button>
            </div>
            {/* Selector de rango */}
            <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Día</SelectItem>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="month">Mes</SelectItem>
              </SelectContent>
            </Select>
            {/* Selector de tipo de datos */}
            <Select value={chartType} onValueChange={(value: any) => setChartType(value)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="amount">Montos</SelectItem>
                <SelectItem value="count">Cantidad</SelectItem>
              </SelectContent>
            </Select>
            {/* Selector de series a mostrar */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  Series
                </Button>
              </PopoverTrigger>
                          <PopoverContent className="w-56">
              <div className="flex flex-col gap-3 p-1">
                {AVAILABLE_SERIES.map((serie) => (
                  <label key={serie.key} className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={selectedSeries.includes(serie.key)}
                      onCheckedChange={(checked) => {
                        setSelectedSeries((prev) =>
                          checked
                            ? [...prev, serie.key]
                            : prev.filter((k) => k !== serie.key)
                        )
                      }}
                      id={`series-${serie.key}`}
                      className="mt-0.5"
                    />
                    <div className="flex items-center gap-2 min-w-0">
                      <span 
                        style={{ 
                          backgroundColor: serie.color, 
                          width: 14, 
                          height: 14, 
                          borderRadius: "50%", 
                          display: "inline-block",
                          border: "2px solid #e5e7eb",
                          flexShrink: 0
                        }} 
                      />
                      <span className="text-sm font-medium leading-tight break-words">
                        {serie.label}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </PopoverContent>
            </Popover>
            {/* Selector de tipo de gráfica */}
            <div className="flex gap-1">
              <Button variant={viewType === "bar" ? "default" : "outline"} size="sm" onClick={() => setViewType("bar")}> <BarChart3 className="h-4 w-4" /> </Button>
              <Button variant={viewType === "line" ? "default" : "outline"} size="sm" onClick={() => setViewType("line")}> <LineChartIcon className="h-4 w-4" /> </Button>
            </div>
            {/* Botón de actualizar */}
            <Button variant="outline" size="sm" onClick={fetchChartData} disabled={loading}>
              {loading ? "Cargando..." : "Actualizar"}
            </Button>

            {/* Botón de debug para verificar configuración */}
            {/* <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                const saved = localStorage.getItem(STORAGE_KEY)
                console.log("Configuración actual en localStorage:", saved ? JSON.parse(saved) : "No hay configuración")
                console.log("Estado actual:", {
                  chartType,
                  viewType,
                  dateRange,
                  selectedSeries,
                  selectedDate: selectedDate.toISOString(),
                })
              }}
            >
              Debug
            </Button> */}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-[300px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-[300px] text-red-600">
            <p>{error}</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-gray-500">
            <p>No se encontraron registros.</p>
          </div>
        ) : (
          renderChart()
        )}
      </CardContent>
    </Card>
  )
}
