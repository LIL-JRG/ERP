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

interface ChartData {
  date: string
  ventas: number
  cotizaciones: number
  ventasCount: number
  cotizacionesCount: number
  displayDate: string
}

interface DashboardChartProps {
  onDataUpdate?: () => void
}

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
        .select("total, created_at")
        .eq("status", "completada")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())

      if (salesError) {
        console.error("Error fetching sales:", salesError)
      }

      // Obtener datos de cotizaciones
      const { data: quotesData, error: quotesError } = await supabase
        .from("quotes")
        .select("total, created_at")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())

      if (quotesError) {
        console.error("Error fetching quotes:", quotesError)
      }

      console.log("Sales data:", salesData?.length || 0, "records")
      console.log("Quotes data:", quotesData?.length || 0, "records")

      // Procesar datos según el rango
      const processedData = processDataByRange(dataPoints, salesData || [], quotesData || [])

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

  const processDataByRange = (dataPoints: Date[], salesData: any[], quotesData: any[]): ChartData[] => {
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

      return {
        date: point.toISOString(),
        displayDate,
        ventas: periodSales.reduce((sum, sale) => sum + (sale.total || 0), 0),
        cotizaciones: periodQuotes.reduce((sum, quote) => sum + (quote.total || 0), 0),
        ventasCount: periodSales.length,
        cotizacionesCount: periodQuotes.length,
      }
    })
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

      return {
        date: point.toISOString(),
        displayDate,
        ventas: Math.floor(Math.random() * 2000) + 500,
        cotizaciones: Math.floor(Math.random() * 3000) + 1000,
        ventasCount: Math.floor(Math.random() * 5) + 1,
        cotizacionesCount: Math.floor(Math.random() * 8) + 2,
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
              {entry.name}: {chartType === "amount" ? formatCurrency(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const processedData = chartData.map((item) => ({
    displayDate: item.displayDate,
    ventas: chartType === "amount" ? item.ventas : item.ventasCount,
    cotizaciones: chartType === "amount" ? item.cotizaciones : item.cotizacionesCount,
  }))

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
            <Bar dataKey="ventas" fill="#10b981" name="Ventas" />
            <Bar dataKey="cotizaciones" fill="#f59e0b" name="Cotizaciones" />
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
            <Line type="monotone" dataKey="ventas" stroke="#10b981" strokeWidth={2} name="Ventas" />
            <Line type="monotone" dataKey="cotizaciones" stroke="#f59e0b" strokeWidth={2} name="Cotizaciones" />
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
              <Button variant="outline" size="sm" onClick={() => navigateDate("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-[140px] bg-transparent">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(selectedDate, "dd/MM/yyyy", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
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
                  />
                </PopoverContent>
              </Popover>

              <Button variant="outline" size="sm" onClick={() => navigateDate("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
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

            {/* Selector de tipo de gráfica */}
            <div className="flex gap-1">
              <Button variant={viewType === "bar" ? "default" : "outline"} size="sm" onClick={() => setViewType("bar")}>
                <BarChart3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewType === "line" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewType("line")}
              >
                <LineChartIcon className="h-4 w-4" />
              </Button>
            </div>

            {/* Botón de actualizar */}
            <Button variant="outline" size="sm" onClick={fetchChartData} disabled={loading}>
              {loading ? "Cargando..." : "Actualizar"}
            </Button>
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
