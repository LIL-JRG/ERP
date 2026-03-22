"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, TrendingUp, Calculator } from "lucide-react"
import { useSettings } from "@/hooks/use-settings"
import { cn } from "@/lib/utils"

interface CashMovement {
  id: string
  type: "entrada" | "salida"
  amount: number
  concept: string
  created_at: string
}

export default function QuickEntries() {
  const { formatCurrency } = useSettings()
  const [entries, setEntries] = useState<CashMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [concept, setConcept] = useState("")
  const [displayValue, setDisplayValue] = useState("0")

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in the concept input
      if (document.activeElement instanceof HTMLInputElement) return

      if (e.key >= "0" && e.key <= "9") {
        handleNumberClick(e.key)
      } else if (e.key === "." || e.key === ",") {
        handleDecimalClick()
      } else if (e.key === "Backspace") {
        handleBackspace()
      } else if (e.key === "c" || e.key === "C" || e.key === "Escape") {
        handleClear()
      } else if (e.key === "Enter") {
        handleAddEntry()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    fetchTodayEntries()
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [displayValue, concept])

  const fetchTodayEntries = async () => {
    try {
      const today = new Date().toISOString().split("T")[0]
      const { data, error } = await supabase
        .from("cash_movements")
        .select("*")
        .eq("type", "entrada")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`)
        .order("created_at", { ascending: false })

      if (error) throw error
      setEntries(data || [])
    } catch (error) {
      console.error("Error fetching entries:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleNumberClick = (num: string) => {
    if (displayValue === "0") {
      setDisplayValue(num)
    } else {
      setDisplayValue(displayValue + num)
    }
  }

  const handleDecimalClick = () => {
    if (!displayValue.includes(".")) {
      setDisplayValue(displayValue + ".")
    }
  }

  const handleClear = () => {
    setDisplayValue("0")
  }

  const handleBackspace = () => {
    if (displayValue.length > 1) {
      setDisplayValue(displayValue.slice(0, -1))
    } else {
      setDisplayValue("0")
    }
  }

  const handleAddEntry = async () => {
    if (!displayValue || displayValue === "0" || !concept.trim()) {
      return
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase.from("cash_movements").insert([
        {
          type: "entrada",
          amount: Number.parseFloat(displayValue),
          concept: concept.trim(),
          user_id: user?.id,
        },
      ])

      if (error) throw error

      setDisplayValue("0")
      setConcept("")
      await fetchTodayEntries()
    } catch (error) {
      console.error("Error adding entry:", error)
    }
  }

  const getTotalEntries = () => {
    return entries.reduce((sum, entry) => sum + entry.amount, 0)
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("es-MX", {
      timeStyle: "short",
    }).format(date)
  }

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] gap-6 animate-pulse">
        <div className="w-20 h-20 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-2xl font-black text-slate-300 uppercase tracking-tighter italic">Sincronizando Entradas...</p>
      </div>
    )
  }

  return (
    <div className="space-y-12 p-6 md:p-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      {/* Massive Big UI Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-4">
        <div>
          <h1 className="text-7xl md:text-8xl font-black tracking-tighter text-slate-900 leading-[0.8] mb-4">
            Entradas<span className="text-emerald-500">.</span>
          </h1>
          <p className="text-xl font-bold text-slate-400 uppercase tracking-widest italic ml-1">
            Ingresos de caja y capital rápido
          </p>
        </div>
        <div className="bg-white px-10 py-6 rounded-[32px] shadow-sm border border-slate-50 flex flex-col items-end">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">TOTAL ACUMULADO HOY</p>
          <h2 className="text-5xl font-black text-emerald-500 tracking-tighter italic leading-none">{formatCurrency(getTotalEntries())}</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
        {/* Premium Calculator Card */}
        <Card className="rounded-[44px] border-none shadow-sm bg-white overflow-hidden p-10 space-y-8 border border-slate-50">
          <div className="space-y-2">
            <div className="flex items-center gap-3 ml-1 mb-2">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <TrendingUp className="h-5 w-5" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Importe de la entrada</p>
            </div>
            
            {/* Massive Display */}
            <div className="bg-slate-50 rounded-[32px] p-8 md:p-10 border border-slate-100/50 group hover:border-emerald-200 transition-colors duration-500 min-h-[160px] flex items-center">
              <div className="flex items-start justify-between w-full gap-4">
                <span className="text-4xl font-black text-emerald-500/30 tracking-tighter mt-2 shrink-0">$</span>
                <div className="text-7xl md:text-8xl lg:text-9xl font-black text-emerald-600 tracking-tighter italic leading-[0.8] break-all text-right flex-1">
                  {displayValue}
                </div>
              </div>
            </div>
          </div>

          {/* Concepto Input Big UI */}
          <div className="space-y-4">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Referencia o Concepto</p>
            <Input
              placeholder="EJ. PAGO DE CLIENTE, REPOSICIÓN..."
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="h-20 px-8 rounded-[24px] border-none bg-slate-50 shadow-sm font-black text-xl uppercase tracking-widest placeholder:text-slate-200 focus-visible:ring-4 focus-visible:ring-emerald-500/10 transition-all text-slate-900"
            />
          </div>

          {/* Big UI Keyboard */}
          <div className="grid grid-cols-4 gap-4">
            {["7", "8", "9", "C"].map((key) => (
              <Button
                key={key}
                variant="ghost"
                onClick={() => key === "C" ? handleClear() : handleNumberClick(key)}
                className={cn(
                  "h-20 rounded-[20px] text-2xl font-black transition-all active:scale-90",
                  key === "C" ? "bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white" : "bg-slate-50 text-slate-900 hover:bg-slate-900 hover:text-white"
                )}
              >
                {key}
              </Button>
            ))}
            {["4", "5", "6", "⌫"].map((key) => (
              <Button
                key={key}
                variant="ghost"
                onClick={() => key === "⌫" ? handleBackspace() : handleNumberClick(key)}
                className={cn(
                  "h-20 rounded-[20px] text-2xl font-black transition-all active:scale-90",
                  key === "⌫" ? "bg-slate-100 text-slate-400 hover:bg-slate-900 hover:text-white" : "bg-slate-50 text-slate-900 hover:bg-slate-900 hover:text-white"
                )}
              >
                {key}
              </Button>
            ))}
            {["1", "2", "3", "00"].map((key) => (
              <Button
                key={key}
                variant="ghost"
                onClick={() => handleNumberClick(key)}
                className="h-20 rounded-[20px] bg-slate-50 text-slate-900 font-black text-2xl hover:bg-slate-900 hover:text-white transition-all active:scale-90"
              >
                {key}
              </Button>
            ))}
            <Button
              variant="ghost"
              onClick={() => handleNumberClick("0")}
              className="h-20 rounded-[20px] bg-slate-50 text-slate-900 font-black text-2xl hover:bg-slate-900 hover:text-white transition-all active:scale-90"
            >
              0
            </Button>
            <Button
              variant="ghost"
              onClick={handleDecimalClick}
              className="h-20 rounded-[20px] bg-slate-50 text-slate-900 font-black text-2xl hover:bg-slate-900 hover:text-white transition-all active:scale-90"
            >
              .
            </Button>
            <Button
              onClick={handleAddEntry}
              disabled={displayValue === "0" || !concept.trim()}
              className="h-20 col-span-2 rounded-[24px] bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-30"
            >
              <Plus className="h-5 w-5 mr-3" />
              Registrar Entrada
            </Button>
          </div>
        </Card>

        {/* History Big UI Card */}
        <Card className="rounded-[44px] border-none shadow-sm bg-white overflow-hidden p-4 border border-slate-50">
          <div className="p-6 pb-2">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 ml-4 mb-6">FLUJO DE HOY</h3>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-50 hover:bg-transparent">
                  <TableHead className="h-16 px-8 text-[10px] font-black text-slate-500 uppercase tracking-widest w-32">HORARIO</TableHead>
                  <TableHead className="h-16 text-[10px] font-black text-slate-500 uppercase tracking-widest">CONCEPTO / REFERENCIA</TableHead>
                  <TableHead className="h-16 px-8 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">IMPORTE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length > 0 ? entries.map((entry) => (
                  <TableRow key={entry.id} className="group border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <TableCell className="px-8 py-6 font-black text-slate-400 text-[11px] font-mono">
                      {formatTime(entry.created_at)}
                    </TableCell>
                    <TableCell className="py-6">
                      <span className="text-sm font-black text-slate-900 uppercase tracking-tight italic">{entry.concept}</span>
                    </TableCell>
                    <TableCell className="px-8 py-6 text-right">
                      <span className="text-xl font-black text-emerald-600 tracking-tighter italic">{formatCurrency(entry.amount)}</span>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="h-64 text-center">
                      <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-500">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
                          <Calculator className="h-8 w-8" />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin transacciones registradas hoy</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  )
}
