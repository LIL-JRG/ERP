"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Minus, TrendingDown, Calculator } from "lucide-react"
import { useSettings } from "@/hooks/use-settings"

interface CashMovement {
  id: string
  type: "entrada" | "salida"
  amount: number
  concept: string
  created_at: string
}

export default function QuickExits() {
  const { formatCurrency } = useSettings()
  const [exits, setExits] = useState<CashMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState("")
  const [concept, setConcept] = useState("")
  const [displayValue, setDisplayValue] = useState("0")

  useEffect(() => {
    fetchTodayExits()
  }, [])

  const fetchTodayExits = async () => {
    try {
      const today = new Date().toISOString().split("T")[0]
      const { data, error } = await supabase
        .from("cash_movements")
        .select("*")
        .eq("type", "salida")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`)
        .order("created_at", { ascending: false })

      if (error) throw error
      setExits(data || [])
    } catch (error) {
      console.error("Error fetching exits:", error)
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

  const handleAddExit = async () => {
    if (!displayValue || displayValue === "0" || !concept.trim()) {
      alert("Ingresa un monto y concepto válidos")
      return
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase.from("cash_movements").insert([
        {
          type: "salida",
          amount: Number.parseFloat(displayValue),
          concept: concept.trim(),
          user_id: user?.id,
        },
      ])

      if (error) throw error

      // Limpiar formulario
      setDisplayValue("0")
      setConcept("")

      // Recargar salidas
      await fetchTodayExits()
    } catch (error) {
      console.error("Error adding exit:", error)
      alert("Error al registrar la salida")
    }
  }

  const getTotalExits = () => {
    return exits.reduce((sum, exit) => sum + exit.amount, 0)
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("es-MX", {
      timeStyle: "short",
    }).format(date)
  }

  return (
    <div className="space-y-6 p-2 md:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calculadora */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-red-600">
              <TrendingDown className="h-5 w-5 mr-2" />
              Salidas Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Display */}
            <div className="bg-gray-100 p-4 rounded-lg">
              <div className="text-right text-3xl font-bold text-red-600">${displayValue}</div>
            </div>

            {/* Concepto */}
            <div className="space-y-2">
              <Input
                placeholder="Concepto de la salida..."
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                className="text-center"
              />
            </div>

            {/* Calculadora */}
            <div className="grid grid-cols-4 gap-2">
              {/* Fila 1 */}
              <Button variant="outline" onClick={handleClear} className="h-12 bg-transparent">
                C
              </Button>
              <Button variant="outline" onClick={handleBackspace} className="h-12 bg-transparent">
                ⌫
              </Button>
              <Button variant="outline" onClick={() => handleNumberClick("00")} className="h-12">
                00
              </Button>
              <Button variant="outline" onClick={handleDecimalClick} className="h-12 bg-transparent">
                .
              </Button>

              {/* Fila 2 */}
              <Button variant="outline" onClick={() => handleNumberClick("7")} className="h-12">
                7
              </Button>
              <Button variant="outline" onClick={() => handleNumberClick("8")} className="h-12">
                8
              </Button>
              <Button variant="outline" onClick={() => handleNumberClick("9")} className="h-12">
                9
              </Button>
              <Button variant="outline" onClick={() => handleNumberClick("0")} className="h-12 row-span-2">
                0
              </Button>

              {/* Fila 3 */}
              <Button variant="outline" onClick={() => handleNumberClick("4")} className="h-12">
                4
              </Button>
              <Button variant="outline" onClick={() => handleNumberClick("5")} className="h-12">
                5
              </Button>
              <Button variant="outline" onClick={() => handleNumberClick("6")} className="h-12">
                6
              </Button>

              {/* Fila 4 */}
              <Button variant="outline" onClick={() => handleNumberClick("1")} className="h-12">
                1
              </Button>
              <Button variant="outline" onClick={() => handleNumberClick("2")} className="h-12">
                2
              </Button>
              <Button variant="outline" onClick={() => handleNumberClick("3")} className="h-12">
                3
              </Button>
              <Button
                onClick={handleAddExit}
                className="h-12 bg-red-600 hover:bg-red-700"
                disabled={displayValue === "0" || !concept.trim()}
              >
                <Minus className="h-4 w-4 mr-1" />
                Agregar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Historial del día */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Calculator className="h-5 w-5 mr-2" />
                Salidas de Hoy
              </span>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(getTotalExits())}</div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4">Cargando salidas...</div>
            ) : exits.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hora</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exits.map((exit) => (
                      <TableRow key={exit.id}>
                        <TableCell className="font-mono text-sm">{formatTime(exit.created_at)}</TableCell>
                        <TableCell>{exit.concept}</TableCell>
                        <TableCell className="text-right font-bold text-red-600">
                          {formatCurrency(exit.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No hay salidas registradas hoy</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
