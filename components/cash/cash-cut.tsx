"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calculator, FileText, TrendingUp, TrendingDown, DollarSign, ShoppingCart } from "lucide-react"
import { useSettings } from "@/hooks/use-settings"

interface CashCutData {
  sales: {
    count: number
    total: number
    cash: number
    card: number
    transfer: number
  }
  entries: {
    count: number
    total: number
  }
  exits: {
    count: number
    total: number
  }
  credits: {
    count: number
    total: number
  }
  netTotal: number
  expectedCash: number
}

export default function CashCut() {
  const { formatCurrency, settings } = useSettings()
  const [cashData, setCashData] = useState<CashCutData | null>(null)
  const [loading, setLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const generateCashCut = async () => {
    setLoading(true)
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      // Obtener ventas del día
      const { data: salesData } = await supabase
        .from("sales")
        .select("total, payment_method, sale_type")
        .eq("status", "completada")
        .gte("created_at", today.toISOString())
        .lt("created_at", tomorrow.toISOString())

      // Obtener entradas rápidas
      const { data: entriesData } = await supabase
        .from("cash_movements")
        .select("amount")
        .eq("type", "entrada")
        .gte("created_at", today.toISOString())
        .lt("created_at", tomorrow.toISOString())

      // Obtener salidas rápidas
      const { data: exitsData } = await supabase
        .from("cash_movements")
        .select("amount")
        .eq("type", "salida")
        .gte("created_at", today.toISOString())
        .lt("created_at", tomorrow.toISOString())

      // Calcular totales de ventas por método de pago
      const sales = {
        count: salesData?.length || 0,
        total: salesData?.reduce((sum, sale) => sum + sale.total, 0) || 0,
        cash: salesData?.filter((s) => s.payment_method === "efectivo").reduce((sum, sale) => sum + sale.total, 0) || 0,
        card: salesData?.filter((s) => s.payment_method === "tarjeta").reduce((sum, sale) => sum + sale.total, 0) || 0,
        transfer:
          salesData?.filter((s) => s.payment_method === "transferencia").reduce((sum, sale) => sum + sale.total, 0) ||
          0,
      }

      const entries = {
        count: entriesData?.length || 0,
        total: entriesData?.reduce((sum, entry) => sum + entry.amount, 0) || 0,
      }

      const exits = {
        count: exitsData?.length || 0,
        total: exitsData?.reduce((sum, exit) => sum + exit.amount, 0) || 0,
      }

      const credits = {
        count: salesData?.filter((s) => s.sale_type === "credito").length || 0,
        total: salesData?.filter((s) => s.sale_type === "credito").reduce((sum, sale) => sum + sale.total, 0) || 0,
      }

      const expectedCash = sales.cash + entries.total - exits.total
      const netTotal = sales.total + entries.total - exits.total

      setCashData({
        sales,
        entries,
        exits,
        credits,
        netTotal,
        expectedCash,
      })
      setIsDialogOpen(true)
    } catch (error) {
      console.error("Error generating cash cut:", error)
      alert("Error al generar el corte de caja")
    } finally {
      setLoading(false)
    }
  }

  const generatePDFReport = () => {
    if (!cashData) return

    const reportContent = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin-bottom: 10px;">${settings.business_name}</h1>
          <h2 style="color: #666; margin-bottom: 5px;">CORTE DE CAJA</h2>
          <p style="color: #888; margin: 0;">Fecha: ${new Date().toLocaleDateString("es-MX", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}</p>
          <p style="color: #888; margin: 0;">Hora: ${new Date().toLocaleTimeString("es-MX")}</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
          <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px;">
            <h3 style="color: #10b981; margin-top: 0;">💰 VENTAS DEL DÍA</h3>
            <p><strong>Total de ventas:</strong> ${cashData.sales.count}</p>
            <p><strong>Monto total:</strong> ${formatCurrency(cashData.sales.total)}</p>
            <hr style="margin: 10px 0;">
            <p><strong>Efectivo:</strong> ${formatCurrency(cashData.sales.cash)}</p>
            <p><strong>Tarjeta:</strong> ${formatCurrency(cashData.sales.card)}</p>
            <p><strong>Transferencia:</strong> ${formatCurrency(cashData.sales.transfer)}</p>
          </div>

          <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px;">
            <h3 style="color: #f59e0b; margin-top: 0;">📋 VENTAS A CRÉDITO</h3>
            <p><strong>Total créditos:</strong> ${cashData.credits.count}</p>
            <p><strong>Monto total:</strong> ${formatCurrency(cashData.credits.total)}</p>
            <p style="color: #888; font-size: 12px;">*No incluido en efectivo esperado</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
          <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px;">
            <h3 style="color: #10b981; margin-top: 0;">📈 ENTRADAS ADICIONALES</h3>
            <p><strong>Total entradas:</strong> ${cashData.entries.count}</p>
            <p><strong>Monto total:</strong> ${formatCurrency(cashData.entries.total)}</p>
          </div>

          <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px;">
            <h3 style="color: #ef4444; margin-top: 0;">📉 SALIDAS</h3>
            <p><strong>Total salidas:</strong> ${cashData.exits.count}</p>
            <p><strong>Monto total:</strong> ${formatCurrency(cashData.exits.total)}</p>
          </div>
        </div>

        <div style="border: 2px solid #333; border-radius: 8px; padding: 20px; background-color: #f9f9f9;">
          <h3 style="color: #333; margin-top: 0; text-align: center;">💵 RESUMEN FINAL</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
              <p style="font-size: 18px;"><strong>Efectivo esperado en caja:</strong></p>
              <p style="font-size: 24px; color: #10b981; font-weight: bold;">${formatCurrency(cashData.expectedCash)}</p>
            </div>
            <div>
              <p style="font-size: 18px;"><strong>Total neto del día:</strong></p>
              <p style="font-size: 24px; color: #333; font-weight: bold;">${formatCurrency(cashData.netTotal)}</p>
            </div>
          </div>
        </div>

        <div style="margin-top: 30px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background-color: #f0f9ff;">
          <h4 style="color: #0369a1; margin-top: 0;">📝 INSTRUCCIONES</h4>
          <ol style="color: #666; line-height: 1.6;">
            <li>Contar el efectivo físico en caja</li>
            <li>Verificar que coincida con el "Efectivo esperado": ${formatCurrency(cashData.expectedCash)}</li>
            <li>Revisar los comprobantes de tarjeta y transferencias</li>
            <li>Documentar cualquier diferencia encontrada</li>
            <li>Firmar y archivar este reporte</li>
          </ol>
        </div>

        <div style="margin-top: 40px; text-align: center; color: #888; font-size: 12px;">
          <p>Reporte generado automáticamente por H2R ACCESORIOS Punto de Venta v1.0</p>
          <p>Fecha de generación: ${new Date().toLocaleString("es-MX")}</p>
        </div>
      </div>
    `

    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      alert("Por favor permite ventanas emergentes para generar el PDF")
      return
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Corte de Caja - ${new Date().toLocaleDateString("es-MX")}</title>
          <meta charset="utf-8" />
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${reportContent}
          <div class="no-print" style="text-align: center; margin-top: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #333; color: white; border: none; border-radius: 5px; cursor: pointer;">Imprimir / Guardar PDF</button>
          </div>
        </body>
      </html>
    `

    printWindow.document.open()
    printWindow.document.documentElement.innerHTML = html
    printWindow.document.close()
  }

  return (
    <>
      <Button onClick={generateCashCut} disabled={loading} size="lg" className="bg-green-600 hover:bg-green-700">
        <Calculator className="h-5 w-5 mr-2" />
        {loading ? "Generando..." : "Corte de Caja"}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              Corte de Caja - {new Date().toLocaleDateString("es-MX")}
            </DialogTitle>
          </DialogHeader>

          {cashData && (
            <div className="space-y-6">
              {/* Resumen principal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-green-200 bg-green-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-green-800 flex items-center">
                      <DollarSign className="h-5 w-5 mr-2" />
                      Efectivo Esperado
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">{formatCurrency(cashData.expectedCash)}</div>
                    <p className="text-sm text-green-700 mt-1">Este es el efectivo que debe estar en caja</p>
                  </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-blue-800 flex items-center">
                      <TrendingUp className="h-5 w-5 mr-2" />
                      Total Neto del Día
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">{formatCurrency(cashData.netTotal)}</div>
                    <p className="text-sm text-blue-700 mt-1">Incluye todos los métodos de pago</p>
                  </CardContent>
                </Card>
              </div>

              {/* Detalles de ventas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Ventas del Día
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span>Total de ventas:</span>
                      <span className="font-bold">{cashData.sales.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monto total:</span>
                      <span className="font-bold">{formatCurrency(cashData.sales.total)}</span>
                    </div>
                    <hr />
                    <div className="flex justify-between">
                      <span>Efectivo:</span>
                      <span className="font-bold text-green-600">{formatCurrency(cashData.sales.cash)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tarjeta:</span>
                      <span className="font-bold text-blue-600">{formatCurrency(cashData.sales.card)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Transferencia:</span>
                      <span className="font-bold text-purple-600">{formatCurrency(cashData.sales.transfer)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <FileText className="h-5 w-5 mr-2" />
                      Ventas a Crédito
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span>Total créditos:</span>
                      <span className="font-bold">{cashData.credits.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monto total:</span>
                      <span className="font-bold text-orange-600">{formatCurrency(cashData.credits.total)}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      * Las ventas a crédito no se incluyen en el efectivo esperado
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Movimientos de caja */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-green-200">
                  <CardHeader>
                    <CardTitle className="flex items-center text-green-800">
                      <TrendingUp className="h-5 w-5 mr-2" />
                      Entradas Adicionales
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span>Total entradas:</span>
                      <span className="font-bold">{cashData.entries.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monto total:</span>
                      <span className="font-bold text-green-600">{formatCurrency(cashData.entries.total)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="flex items-center text-red-800">
                      <TrendingDown className="h-5 w-5 mr-2" />
                      Salidas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span>Total salidas:</span>
                      <span className="font-bold">{cashData.exits.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monto total:</span>
                      <span className="font-bold text-red-600">{formatCurrency(cashData.exits.total)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Instrucciones */}
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-blue-800">Instrucciones para el Corte</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Contar todo el efectivo físico en la caja registradora</li>
                    <li>
                      Verificar que el efectivo contado coincida con:{" "}
                      <strong>{formatCurrency(cashData.expectedCash)}</strong>
                    </li>
                    <li>Revisar los comprobantes de pagos con tarjeta y transferencias</li>
                    <li>Documentar cualquier diferencia encontrada</li>
                    <li>Generar el reporte PDF y archivarlo</li>
                  </ol>
                </CardContent>
              </Card>

              {/* Botones de acción */}
              <div className="flex flex-col sm:flex-row justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cerrar
                </Button>
                <Button onClick={generatePDFReport} className="bg-red-600 hover:bg-red-700">
                  <FileText className="h-4 w-4 mr-2" />
                  Generar Reporte PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
