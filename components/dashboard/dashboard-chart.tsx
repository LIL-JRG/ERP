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
import { BarChart3, BarChart as BarChartIcon, LineChart as LineChartIcon, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { supabase } from "@/lib/supabase"
import React from "react"
import { Checkbox } from "@/components/ui/checkbox"

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

// Presets de series disponibles
const CHART_PRESETS: ChartPreset[] = [
  {
    key: 'ventas_cotizaciones',
    label: 'Cotizaciones vs Ventas',
    series: [
      { key: 'ventas', label: 'Ventas', color: '#10b981' },
      { key: 'cotizaciones', label: 'Cotizaciones', color: '#f59e0b' }
    ]
  },
  {
    key: 'flujo_efectivo',
    label: 'Entradas y Salidas de Efectivo',
    series: [
      { key: 'entradas', label: 'Entradas', color: '#10b981' },
      { key: 'salidas', label: 'Salidas', color: '#ef4444' }
    ]
  }
];

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
  const [viewType, setViewType] = useState<"bar" | "line">("bar")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dateRange, setDateRange] = useState<"day" | "week" | "month">("week")
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  // Estado para las series seleccionadas
  const [selectedPreset, setSelectedPreset] = useState<ChartPreset>(CHART_PRESETS[0]);
  const [selectedSeries, setSelectedSeries] = useState<string[]>(['ventas', 'cotizaciones'])

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
        if (parsed.selectedDate) setSelectedDate(new Date(parsed.selectedDate));
        
        // Cargar preset y series seleccionadas
        if (parsed.selectedPreset && CHART_PRESETS.some(p => p.key === parsed.selectedPreset)) {
          console.log('Loading saved preset from config:', parsed.selectedPreset);
          const preset = CHART_PRESETS.find(p => p.key === parsed.selectedPreset) || CHART_PRESETS[0];
          console.log('Initializing with preset:', preset);
          
          const initialSeries = preset.series.map(s => s.key);
          console.log('Initial series:', initialSeries);
          
          setSelectedPreset(preset);
          setSelectedSeries(initialSeries);
        } else {
          // Valor por defecto
          console.log('Using default preset: ventas_cotizaciones');
          setSelectedPreset(CHART_PRESETS[0]);
          setSelectedSeries(CHART_PRESETS[0].series.map(s => s.key));
        }
      } catch (error) {
        console.error("Error al cargar configuración:", error);
        console.log('Falling back to default preset');
        setSelectedPreset(CHART_PRESETS[0]);
        setSelectedSeries(CHART_PRESETS[0].series.map(s => s.key));
      }
    } else {
      console.log("No hay configuración guardada, usando valores por defecto");
      setSelectedPreset(CHART_PRESETS[0]);
      setSelectedSeries(CHART_PRESETS[0].series.map(s => s.key));
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
      selectedDate: selectedDate.toISOString(),
      selectedPreset: selectedPreset.key, // Solo guardar la clave del preset
      selectedSeries
    };
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('chartConfig', JSON.stringify(config));
    }
  }, [chartType, viewType, dateRange, selectedDate, selectedPreset, selectedSeries, configLoaded]);
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

      // Obtener datos de movimientos de efectivo (entradas y salidas)
      const { data: cashFlowData, error: cashFlowError } = await supabase
        .from("cash_movements")
        .select("amount, type, created_at")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())

      if (cashFlowError) {
        console.error("Error al obtener movimientos de efectivo:", cashFlowError)
      }

      console.log("Sales data:", salesData?.length || 0, "records")
      console.log("Quotes data:", quotesData?.length || 0, "records")
      console.log("Cash flow data:", cashFlowData?.length || 0, "records")

      // Procesar datos según el rango
      const processedData = processDataByRange(
        dataPoints, 
        salesData || [], 
        quotesData || [],
        cashFlowData || []
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

      if (!hasData) {
        console.log("No real data found, showing empty state");
        setChartData([]);
      } else {
        console.log("Setting chart data with", processedData.length, "data points");
        setChartData(processedData);
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

  // Función para convertir una fecha a la zona horaria local
  const toLocalDate = (date: Date): Date => {
    const localDate = new Date(date);
    localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
    return localDate;
  };

  // Función para obtener la hora local de una fecha
  const getLocalHour = (date: Date): number => {
    return toLocalDate(date).getHours();
  };

  const processDataByRange = (
    dataPoints: Date[], 
    salesData: any[], 
    quotesData: any[],
    cashFlowData: any[]
  ): ChartData[] => {
    console.log('=== Starting processDataByRange ===');
    console.log('Data points count:', dataPoints.length);
    console.log('Sales records:', salesData.length);
    console.log('Quotes records:', quotesData.length);
    console.log('Cash flow records:', cashFlowData.length);
    
    if (cashFlowData.length > 0) {
      console.log('First cash flow record:', {
        ...cashFlowData[0],
        created_at: new Date(cashFlowData[0].created_at).toLocaleString(),
        localDate: toLocalDate(new Date(cashFlowData[0].created_at)).toLocaleString()
      });
    }
    console.log('Processing data points:', dataPoints.length);
    console.log('Sales data count:', salesData.length);
    console.log('Quotes data count:', quotesData.length);
    console.log('Cash flow data count:', cashFlowData.length);

    // Inicializar los datos del gráfico con valores en cero
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

    // Procesar ventas
    salesData.forEach((sale: any) => {
      if (!sale || !sale.created_at) return;
      
      const saleDate = new Date(sale.created_at);
      const localSaleDate = toLocalDate(saleDate);
      
      // Encontrar el índice del punto de datos correspondiente
      const dataIndex = dateRange === "day"
        ? getLocalHour(saleDate)  // Usar la hora local para el índice
        : dataPoints.findIndex((dp: Date) => 
            dp.getDate() === localSaleDate.getDate() &&
            dp.getMonth() === localSaleDate.getMonth() &&
            dp.getFullYear() === localSaleDate.getFullYear()
          );
      
      if (dataIndex >= 0 && dataIndex < resultData.length) {
        const total = parseFloat(sale.total) || 0;
        resultData[dataIndex].ventas += total;
        resultData[dataIndex].ventasCount++;
      }
    });

    // Procesar cotizaciones
    quotesData.forEach((quote: any) => {
      if (!quote || !quote.created_at) return;
      
      const quoteDate = new Date(quote.created_at);
      const localQuoteDate = toLocalDate(quoteDate);
      
      // Encontrar el índice del punto de datos correspondiente
      const dataIndex = dateRange === "day"
        ? getLocalHour(quoteDate)  // Usar la hora local para el índice
        : dataPoints.findIndex((dp: Date) => 
            dp.getDate() === localQuoteDate.getDate() &&
            dp.getMonth() === localQuoteDate.getMonth() &&
            dp.getFullYear() === localQuoteDate.getFullYear()
          );
      
      if (dataIndex >= 0 && dataIndex < resultData.length) {
        const total = parseFloat(quote.total) || 0;
        resultData[dataIndex].cotizaciones += total;
        resultData[dataIndex].cotizacionesCount++;
      }
    });

    // Procesar movimientos de efectivo
    console.log('Processing cash flow data:', cashFlowData);
    cashFlowData.forEach((flow: any, index: number) => {
      if (!flow || !flow.created_at) {
        console.log(`Skipping cash flow record ${index}: missing created_at`);
        return;
      }
      
      const flowDate = new Date(flow.created_at);
      const localFlowDate = toLocalDate(flowDate);
      
      console.log(`Cash flow record ${index}:`, {
        created_at: flow.created_at,
        localDate: localFlowDate.toString(),
        type: flow.type,
        amount: flow.amount
      });
      
      // Encontrar el índice del punto de datos correspondiente
      let dataIndex = -1;
      
      if (dateRange === "day") {
        // Para vista diaria, agrupar por hora
        const hour = getLocalHour(flowDate);
        dataIndex = dataPoints.findIndex((dp: Date) => {
          const dpHour = getLocalHour(dp);
          return dpHour === hour;
        });
        
        console.log(`Matching hour ${hour} to data index ${dataIndex}`);
      } else {
        // Para vista semanal o mensual, agrupar por día
        dataIndex = dataPoints.findIndex((dp: Date) => {
          const match = 
            dp.getDate() === localFlowDate.getDate() &&
            dp.getMonth() === localFlowDate.getMonth() &&
            dp.getFullYear() === localFlowDate.getFullYear();
          
          if (match) {
            console.log(`Matched date: ${dp.toISOString()} with ${localFlowDate.toISOString()} at index ${dataIndex}`);
          }
          
          return match;
        });
      }
      
      if (dataIndex >= 0 && dataIndex < resultData.length) {
        const amount = parseFloat(flow.amount) || 0;
        console.log(`Adding ${flow.type} of ${amount} to index ${dataIndex}`);
        
        if (flow.type === 'entrada') {
          resultData[dataIndex].entradas += amount;
        } else if (flow.type === 'salida') {
          resultData[dataIndex].salidas += Math.abs(amount);
        }
        
        console.log(`Updated data at index ${dataIndex}:`, resultData[dataIndex]);
      } else {
        console.log(`No matching time slot found for cash flow record at ${flow.created_at}`);
      }
    });

    console.log('Processed chart data:', resultData);
    return resultData;
  }

  // Generar datos de ejemplo cuando no hay datos reales
  const generateDemoData = (): ChartData[] => {
    const { dataPoints } = getDateRange()
    return dataPoints.map((point) => {
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
      const entradas = Math.floor(Math.random() * 2500) + 1000
      const salidas = Math.floor(Math.random() * 2000) + 500

      return {
        date: point.toISOString(),
        displayDate,
        ventas,
        cotizaciones,
        ventasCount,
        cotizacionesCount,
        entradas,
        salidas
      } as ChartData
    })
  }

  // Navegar entre fechas
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

  // Manejar cambio de preset
  const handlePresetChange = useCallback((value: string) => {
    console.log('Changing preset to:', value);
    const preset = CHART_PRESETS.find(p => p.key === value) || CHART_PRESETS[0];
    console.log('New preset:', preset);
    
    const newSeries = preset.series.map(s => s.key);
    console.log('Setting selected series:', newSeries);
    
    setSelectedPreset(preset);
    setSelectedSeries(newSeries);
    
    // Guardar preferencia en localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('chartPreset', preset.key);
    }
  }, []);

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

  // Procesar datos según series seleccionadas
  const processedData = chartData.map((item) => {
    const obj: Record<string, any> = { displayDate: item.displayDate }
    
    // Agregar solo las series que están seleccionadas
    selectedSeries.forEach(seriesKey => {
      if (['ventas', 'cotizaciones'].includes(seriesKey)) {
        obj[seriesKey] = chartType === 'amount' 
          ? item[seriesKey as keyof ChartData] as number 
          : item[`${seriesKey}Count` as keyof ChartData] as number
      } else if (['entradas', 'salidas'].includes(seriesKey)) {
        obj[seriesKey] = item[seriesKey as keyof ChartData] as number
      }
    })
    
    return obj as Record<string, any>
  })

  // Renderizar la gráfica según las series seleccionadas
  const renderChart = () => {
    console.log('Rendering chart with data:', processedData);
    console.log('Selected preset:', selectedPreset);
    console.log('Selected series:', selectedSeries);
    
    // Verificar datos de series seleccionadas
    selectedSeries.forEach(key => {
      const hasData = processedData.some(item => item[key] > 0);
      console.log(`Series ${key} has data:`, hasData);
      if (!hasData) {
        console.log(`No data found for series: ${key}`);
      }
    });
    
    const commonProps = {
      data: processedData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    }

    const renderSeries = () => {
      console.log('Rendering series for:', selectedSeries);
      
      return selectedSeries.map(key => {
        const series = ALL_SERIES[key as keyof typeof ALL_SERIES];
        if (!series) return null;
        
        console.log(`Rendering series ${series.key} with color ${series.color}`);
        
        const seriesProps = {
          key: series.key,
          name: series.label,
          dataKey: series.key,
          stroke: series.color,
          fill: series.color,
          strokeWidth: 2
        };

        return viewType === 'bar' ? (
          <Bar {...seriesProps} />
        ) : (
          <Line type="monotone" {...seriesProps} />
        );
      });
    }

    const ChartComponent = viewType === 'bar' ? BarChart : LineChart

    return (
      <div className="w-full h-[300px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="displayDate" 
              tick={{ fontSize: 12 }}
              tickMargin={8}
            />
            <YAxis 
              tickFormatter={selectedPreset.key === 'ventas_cotizaciones' && chartType === 'amount' 
                ? (value: number) => `$${value.toLocaleString()}` 
                : undefined}
              tick={{ fontSize: 12 }}
              tickMargin={8}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {renderSeries()}
          </ChartComponent>
        </ResponsiveContainer>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>
    )
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
            {/* Selector de preset */}
            <Select 
              value={selectedPreset.key}
              onValueChange={handlePresetChange}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Seleccionar vista">
                  {selectedPreset.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CHART_PRESETS.map((preset) => (
                  <SelectItem 
                    key={preset.key} 
                    value={preset.key}
                    className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
