"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Minus, TrendingUp, TrendingDown, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface QuickMovementsWidgetProps {
  onUpdate?: () => void
}

export function QuickMovementsWidget({ onUpdate }: QuickMovementsWidgetProps) {
  const [type, setType] = useState<"entrada" | "salida">("entrada")
  const [amount, setAmount] = useState("")
  const [concept, setConcept] = useState("")
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!amount || parseFloat(amount) <= 0 || !concept.trim()) {
      toast.error("Ingresa un monto y concepto válidos")
      return
    }

    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase.from("cash_movements").insert([
        {
          type,
          amount: parseFloat(amount),
          concept: concept.trim(),
          user_id: user?.id,
        },
      ])

      if (error) throw error

      toast.success(`${type === 'entrada' ? 'Entrada' : 'Salida'} registrada correctamente`)
      setAmount("")
      setConcept("")
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error("Error registering movement:", error)
      toast.error("Error al registrar el movimiento")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-none shadow-sm rounded-[40px] overflow-hidden bg-white h-full">
      <CardHeader className="p-8 pb-4">
        <CardTitle className="text-2xl font-black text-slate-900 tracking-tight flex items-center justify-between">
          Movimiento Rápido
          {type === 'entrada' ? (
            <TrendingUp className="h-6 w-6 text-emerald-500" />
          ) : (
            <TrendingDown className="h-6 w-6 text-rose-500" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8 pt-4 space-y-6">
        {/* Type Selector */}
        <div className="flex bg-slate-50 p-1.5 rounded-2xl gap-1.5 border border-slate-100">
          <Button
            variant="ghost"
            className={cn(
              "flex-1 rounded-xl font-black text-xs uppercase tracking-widest transition-all",
              type === "entrada" 
                ? "bg-white text-emerald-600 shadow-sm" 
                : "text-slate-400 hover:text-slate-600"
            )}
            onClick={() => setType("entrada")}
          >
            <Plus className="h-4 w-4 mr-2" />
            Entrada
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "flex-1 rounded-xl font-black text-xs uppercase tracking-widest transition-all",
              type === "salida" 
                ? "bg-white text-rose-600 shadow-sm" 
                : "text-slate-400 hover:text-slate-600"
            )}
            onClick={() => setType("salida")}
          >
            <Minus className="h-4 w-4 mr-2" />
            Salida
          </Button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">MONTO</p>
            <div className="relative group">
              <span className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 font-black text-xl transition-colors",
                type === 'entrada' ? "text-emerald-500" : "text-rose-500"
              )}>$</span>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={cn(
                  "pl-10 h-14 bg-slate-50 border-none rounded-2xl text-2xl font-black tracking-tighter placeholder:text-slate-300 focus-visible:ring-2 transition-all",
                  type === 'entrada' ? "text-emerald-600 focus-visible:ring-emerald-500/20" : "text-rose-600 focus-visible:ring-rose-500/20"
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">CONCEPTO</p>
            <Input
              placeholder="Ej. Pago de flete..."
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="h-14 bg-slate-50 border-none rounded-2xl text-base font-black text-slate-700 placeholder:text-slate-300 focus-visible:ring-2 focus-visible:ring-slate-200"
            />
          </div>
        </div>

        <Button
          onClick={handleRegister}
          disabled={loading || !amount || !concept}
          className={cn(
            "w-full h-16 rounded-3xl font-black text-sm uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 disabled:opacity-50",
            type === 'entrada' 
              ? "bg-[#10b981] hover:bg-[#059669] text-white shadow-emerald-200" 
              : "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200"
          )}
        >
          {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : "Registrar ahora"}
        </Button>

        <p className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed px-4">
          Este movimiento se reflejará instantáneamente en el reporte de flujo de caja de hoy.
        </p>
      </CardContent>
    </Card>
  )
}
