"use client"

import { useState, useEffect, useCallback } from "react"
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
import { 
  BarChart3, 
  BarChart as BarChartIcon, 
  LineChart as LineChartIcon, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  RefreshCw 
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { supabase } from "@/lib/supabase"
import React from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

interface ChartData {
  date: string
  displayDate: string
  ventas: number
  cotizaciones: number
  ventasCount: number
  cotizacionesCount: number
  entradas: number
  salidas: number
}

interface DashboardChartProps {
  onDataUpdate?: () => void
}

// Types for chart presets
type ChartPreset = {
  key: string;
  label: string;
  series: Array<{
    key: string;
    label: string;
    color: string;
  }>;
};

// Única configuración de series (Flujo de Efectivo)
const CHART_CONFIG = {
  key: 'flujo_efectivo',
  label: 'Análisis de Entradas y Salidas',
  series: [
    { key: 'entradas', label: 'Entradas', color: '#10b981' },
    { key: 'salidas', label: 'Salidas', color: '#ef4444' }
  ]
};

// Todas las series disponibles para referencia
const ALL_SERIES = {
  ventas: { key: 'ventas', label: 'Ventas', color: '#10b981' },
  cotizaciones: { key: 'cotizaciones', label: 'Cotizaciones', color: '#f59e0b' },
  entradas: { key: 'entradas', label: 'Entradas', color: '#10b981' },
  salidas: { key: 'salidas', label: 'Salidas', color: '#ef4444' }
};

export default function DashboardChart({ onDataUpdate }: DashboardChartProps) {
  const { formatCurrency } = useSettings()
  const [chartType, setChartType] = useState<"amount" | "count">("amount")
  const [viewType, setViewType] = useState<"bar" | "line">("line") // default to line for mockup look
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dateRange, setDateRange] = useState<"day" | "week" | "month">("day")
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  // --- Persistencia en localStorage ---
  const STORAGE_KEY = "dashboardChartConfig"
  const [configLoaded, setConfigLoaded] = useState(false)

  // Cargar configuración al montar
  useEffect(() => {
    const savedConfig = typeof window !== 'undefined' ? localStorage.getItem('chartConfig') : null;
    
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        
        // Cargar configuraciones guardadas
        if (parsed.chartType) setChartType(parsed.chartType);
        if (parsed.viewType) setViewType(parsed.viewType);
        if (parsed.dateRange) setDateRange(parsed.dateRange);
        // No cargamos la fecha guardada para que siempre abra en hoy por defecto
        // if (parsed.selectedDate) setSelectedDate(new Date(parsed.selectedDate));
        
      } catch (error) {
        console.error("Error al cargar configuración:", error);
      }
    } else {
      console.log("No hay configuración guardada, usando valores por defecto");
    }
    setConfigLoaded(true);
  }, []);

  // Guardar configuración cuando cambie (solo después de cargar la configuración inicial)
  useEffect(() => {
    if (!configLoaded) return;
    
    const config = {
      chartType,
      viewType,
      dateRange,
      // No guardamos la fecha para evitar que se quede "atrapada" en un día viejo
    };
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('chartConfig', JSON.stringify(config));
    }
  }, [chartType, viewType, dateRange, selectedDate, configLoaded]);
  // --- Fin persistencia ---

  useEffect(() => {
    fetchChartData()
  }, [selectedDate, dateRange])

  const fetchChartData = async () => {
    setLoading(true)
    setError(null)

    try {
      const { startDate, endDate, dataPoints } = getDateRange()

      // Peticiones paralelas para todos los datos
      const [cashFlowRes, salesRes, quotesRes] = await Promise.all([
        supabase
          .from("cash_movements")
          .select("amount, type, created_at")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString()),
        supabase
          .from("sales")
          .select("total, created_at")
          .eq("status", "completada")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString()),
        supabase
          .from("quotes")
          .select("id, created_at")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString())
      ])

      if (cashFlowRes.error) console.error("Error cashFlow:", cashFlowRes.error)
      if (salesRes.error) console.error("Error sales:", salesRes.error)
      if (quotesRes.error) console.error("Error quotes:", quotesRes.error)

      // Procesar datos según el rango
      const processedData = processDataByRange(
        dataPoints, 
        salesRes.data || [], 
        quotesRes.data || [], 
        cashFlowRes.data || []
      )

      console.log("Processed data:", processedData)

      // Verificar si hay datos reales
      const hasData = processedData.some(item => 
        item.ventas > 0 || 
        item.cotizaciones > 0 || 
        item.entradas > 0 || 
        item.salidas > 0
      );

      console.log('Has data to display?', hasData);
      console.log('Processed data summary:', {
        ventas: processedData.reduce((sum, item) => sum + item.ventas, 0),
        cotizaciones: processedData.reduce((sum, item) => sum + item.cotizaciones, 0),
        entradas: processedData.reduce((sum, item) => sum + item.entradas, 0),
        salidas: processedData.reduce((sum, item) => sum + item.salidas, 0),
      });

      // Siempre establecer los datos procesados (con ceros si no hay datos)
      // para que el gráfico muestre el eje X con las fechas correctas
      setChartData(processedData);
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
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)
        for (let i = 0; i < 24; i++) {
          const point = new Date(startDate)
          point.setHours(i)
          dataPoints.push(point)
        }
        break
      case "week":
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
    cashFlowData: any[]
  ): ChartData[] => {
    const resultData = dataPoints.map((point: Date) => {
      const displayDate = dateRange === "day" 
        ? format(point, "HH:mm", { locale: es })
        : format(point, "dd/MM", { locale: es });

      return {
        date: point.toISOString(),
        displayDate,
        ventas: 0,
        cotizaciones: 0,
        ventasCount: 0,
        cotizacionesCount: 0,
        entradas: 0,
        salidas: 0,
      };
    });

    cashFlowData.forEach((flow: any) => {
      if (!flow || !flow.created_at) return;
      
      // Parsear la fecha de forma segura. Si no tiene indicador de zona horaria, 
      // y es solo fecha YYYY-MM-DD, la tratamos como hora local.
      let flowDate: Date;
      const dateStr = flow.created_at.toString();
      
      if (dateStr.length === 10 && dateStr.includes('-')) {
        const [y, m, d] = dateStr.split('-').map(Number);
        flowDate = new Date(y, m - 1, d);
      } else {
        flowDate = new Date(flow.created_at);
      }
      let dataIndex = -1;
      
      if (dateRange === "day") {
        const hour = flowDate.getHours();
        dataIndex = dataPoints.findIndex((dp: Date) => dp.getHours() === hour);
      } else {
        dataIndex = dataPoints.findIndex((dp: Date) => 
          dp.getDate() === flowDate.getDate() &&
          dp.getMonth() === flowDate.getMonth() &&
          dp.getFullYear() === flowDate.getFullYear()
        );
      }
      
      if (dataIndex >= 0 && dataIndex < resultData.length) {
        const amount = parseFloat(flow.amount) || 0;
        if (flow.type === "entrada") resultData[dataIndex].entradas += amount;
        else if (flow.type === "salida") resultData[dataIndex].salidas += amount;
      }
    });

    salesData.forEach((s: any) => {
      const d = new Date(s.created_at);
      const idx = dateRange === "day" 
        ? dataPoints.findIndex(dp => dp.getHours() === d.getHours())
        : dataPoints.findIndex(dp => dp.getDate() === d.getDate() && dp.getMonth() === d.getMonth());
      if (idx >= 0 && idx < resultData.length) {
        resultData[idx].ventas += parseFloat(s.total) || 0;
        resultData[idx].ventasCount++;
      }
    });

    quotesData.forEach((q: any) => {
      const d = new Date(q.created_at);
      const idx = dateRange === "day" 
        ? dataPoints.findIndex(dp => dp.getHours() === d.getHours())
        : dataPoints.findIndex(dp => dp.getDate() === d.getDate() && dp.getMonth() === d.getMonth());
      if (idx >= 0 && idx < resultData.length) {
        resultData[idx].cotizaciones += 1;
        resultData[idx].cotizacionesCount++;
      }
    });

    return resultData;
  }

  const generateDemoData = (): ChartData[] => {
    const { dataPoints } = getDateRange()
    return dataPoints.map((point) => {
      const displayDate = dateRange === "day" 
        ? format(point, "HH:mm", { locale: es })
        : format(point, "dd/MM", { locale: es });

      return {
        date: point.toISOString(),
        displayDate,
        ventas: 0,
        cotizaciones: 0,
        ventasCount: 0,
        cotizacionesCount: 0,
        entradas: Math.floor(Math.random() * 2500) + 1000,
        salidas: Math.floor(Math.random() * 2000) + 500
      } as ChartData
    })
  }

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(selectedDate)
    if (dateRange === 'day') {
      newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 1 : -1))
    } else if (dateRange === 'week') {
      newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 7 : -7))
    } else if (dateRange === 'month') {
      newDate.setMonth(selectedDate.getMonth() + (direction === 'next' ? 1 : -1))
    }
    setSelectedDate(newDate)
  }

  // Tooltip personalizado para mostrar nombres y colores correctos
  interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{
      color: string;
      name: string;
      value: number;
      payload: Record<string, any>;
    }>;
    label?: string;
  }

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (!active || !payload || payload.length === 0) return null;
    
    const formatTooltipValue = (name: string, value: number) => {
      // Verificar si es una métrica de porcentaje
      const isPercentage = name.toLowerCase().includes('tasa') || 
                         name.toLowerCase().includes('porcentaje')
      
      // Verificar si es una métrica monetaria
      const isCurrency = ['ventas', 'cotizaciones', 'entradas', 'salidas']
        .some(metric => name.toLowerCase().includes(metric))
      
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
              {entry.name}: {formatTooltipValue(entry.name, entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Renderizar la gráfica exclusivamente para flujo de efectivo
  const renderChart = () => {
    const commonProps = {
      data: chartData, // Usamos directamente chartData ya que no hay filtros adicionales
      margin: { top: 20, right: 30, left: 10, bottom: 0 },
    }

    return (
      <div className="w-full h-[500px] relative mt-10">
        <ResponsiveContainer width="100%" height="100%">
          {viewType === 'bar' ? (
            <BarChart {...commonProps}>
              <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3" />
              <XAxis 
                dataKey="displayDate" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 13, fill: '#64748b', fontWeight: 700 }}
                tickMargin={15}
              />
              <YAxis hide={true} />
              <Tooltip 
                content={<CustomTooltip />} 
                cursor={{ fill: '#f8fafc' }}
              />
              {CHART_CONFIG.series.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={s.color}
                  radius={[10, 10, 0, 0]}
                  barSize={54}
                  animationDuration={1500}
                />
              ))}
            </BarChart>
          ) : (
            <LineChart {...commonProps}>
              <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3" />
              <XAxis 
                dataKey="displayDate" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 13, fill: '#64748b', fontWeight: 700 }}
                tickMargin={15}
              />
              <YAxis hide={true} />
              <Tooltip 
                content={<CustomTooltip />} 
                cursor={{ stroke: '#e2e8f0', strokeWidth: 2 }}
              />
              {CHART_CONFIG.series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={8}
                  dot={{ r: 8, fill: s.color, strokeWidth: 4, stroke: '#fff' }}
                  activeDot={{ r: 12, strokeWidth: 0 }}
                  animationDuration={1500}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[4px] rounded-3xl">
            <Loader2 className="h-8 w-8 animate-spin text-[#10b981]" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8">
        <div className="space-y-2">
          <CardTitle className="text-5xl font-black text-slate-900 tracking-tight">Análisis de Entradas Monetarias</CardTitle>
          <p className="text-base font-bold text-slate-400 uppercase tracking-[0.2em]">Flujo de caja y movimientos</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Navegación de fechas */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-50 rounded-2xl border border-slate-100">
            <Button variant="ghost" size="icon" onClick={() => navigateDate("prev")} className="h-9 w-9 rounded-xl hover:bg-white hover:shadow-sm"> <ChevronLeft className="h-4 w-4" /> </Button>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 px-4 rounded-xl font-bold text-slate-700 hover:bg-white hover:shadow-sm">
                  <CalendarIcon className="h-4 w-4 mr-2 text-[#10b981]" />
                  {format(selectedDate, "MMM yyyy", { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-3xl shadow-2xl border-none" align="center">
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
                  className="rounded-3xl border-0 p-4"
                  locale={es}
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" onClick={() => navigateDate("next")} className="h-9 w-9 rounded-xl hover:bg-white hover:shadow-sm"> <ChevronRight className="h-4 w-4" /> </Button>
          </div>

          <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
            <SelectTrigger className="w-[120px] h-11 bg-slate-50 border-slate-100 rounded-2xl font-bold text-slate-700 focus:ring-[#10b981]/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
              <SelectItem value="day" className="font-bold">Vista Diaria</SelectItem>
              <SelectItem value="week" className="font-bold">Vista Semanal</SelectItem>
              <SelectItem value="month" className="font-bold">Vista Mensual</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100 h-11">
            <Button
               variant={viewType === "bar" ? "secondary" : "ghost"}
               size="icon"
               className={cn("h-9 w-9 rounded-xl transition-all", viewType === "bar" ? "bg-white shadow-sm text-[#10b981]" : "text-slate-400")}
               onClick={() => setViewType("bar")}
            >
              <BarChartIcon className="h-4 w-4" />
            </Button>
            <Button
               variant={viewType === "line" ? "secondary" : "ghost"}
               size="icon"
               className={cn("h-9 w-9 rounded-xl transition-all", viewType === "line" ? "bg-white shadow-sm text-[#10b981]" : "text-slate-400")}
               onClick={() => setViewType("line")}
            >
              <LineChartIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {loading && chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[500px] space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-[#10b981]" />
          <p className="text-base font-black text-slate-400 uppercase tracking-widest">Cargando análisis...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-[500px] bg-rose-50/30 rounded-[32px] border border-dashed border-rose-100 p-8 text-center">
          <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mb-4">
            <RefreshCw className="h-10 w-10 text-rose-500" />
          </div>
          <p className="text-xl font-black text-slate-900 mb-2">Error al sincronizar datos</p>
          <p className="text-base font-bold text-slate-400 mb-6">{error}</p>
          <Button variant="outline" className="rounded-2xl border-rose-200 text-rose-600 font-black px-10 h-12" onClick={fetchChartData}>
            REINTENTAR
          </Button>
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[500px] bg-slate-50/50 rounded-[40px] border border-dashed border-slate-200 p-8 text-center">
          <p className="text-xl font-black text-slate-400 uppercase tracking-widest">No hay registros para este periodo</p>
        </div>
      ) : (
        renderChart()
      )}
    </div>
  )
}
