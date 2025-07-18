"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { User, CreditCard, ShoppingCart, DollarSign, Plus } from "lucide-react"
import { useSettings } from "@/hooks/use-settings"

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  discount_percentage: number
  created_at: string
}

interface Sale {
  id: string
  sale_number: string
  total: number
  payment_method: string
  sale_type: string
  status: string
  created_at: string
}

interface Credit {
  id: string
  total_amount: number
  paid_amount: number
  remaining_amount: number
  status: string
  due_date: string
  notes: string
  created_at: string
  sale: {
    sale_number: string
  }
}

interface CreditPayment {
  id: string
  amount: number
  payment_method: string
  notes: string
  created_at: string
}

interface CustomerDetailProps {
  customer: Customer
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

export default function CustomerDetail({ customer, isOpen, onClose, onUpdate }: CustomerDetailProps) {
  const { formatCurrency } = useSettings()
  const [sales, setSales] = useState<Sale[]>([])
  const [credits, setCredits] = useState<Credit[]>([])
  const [selectedCredit, setSelectedCredit] = useState<Credit | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("efectivo")
  const [paymentNotes, setPaymentNotes] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && customer) {
      fetchCustomerData()
    }
  }, [isOpen, customer])

  const fetchCustomerData = async () => {
    setLoading(true)
    try {
      // Obtener ventas del cliente
      const { data: salesData } = await supabase
        .from("sales")
        .select("*")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })

      setSales(salesData || [])

      // Obtener créditos del cliente
      const { data: creditsData } = await supabase
        .from("customer_credits")
        .select(`
          *,
          sales!inner(sale_number)
        `)
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })

      setCredits(creditsData || [])
    } catch (error) {
      console.error("Error fetching customer data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePayment = async () => {
    if (!selectedCredit || !paymentAmount || Number.parseFloat(paymentAmount) <= 0) {
      alert("Ingresa un monto válido")
      return
    }

    const amount = Number.parseFloat(paymentAmount)
    if (amount > selectedCredit.remaining_amount) {
      alert("El monto no puede ser mayor al saldo pendiente")
      return
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase.from("credit_payments").insert([
        {
          credit_id: selectedCredit.id,
          amount,
          payment_method: paymentMethod,
          notes: paymentNotes,
          user_id: user?.id,
        },
      ])

      if (error) throw error

      setPaymentAmount("")
      setPaymentNotes("")
      setSelectedCredit(null)
      await fetchCustomerData()
      onUpdate()
    } catch (error) {
      console.error("Error processing payment:", error)
      alert("Error al procesar el pago")
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-MX")
  }

  const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0)
  const totalCredits = credits.reduce((sum, credit) => sum + credit.remaining_amount, 0)
  const completedSales = sales.filter((sale) => sale.status === "completada").length

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <User className="h-5 w-5 mr-2" />
            {customer.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información del cliente */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Total en Ventas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(totalSales)}</div>
                <p className="text-xs text-gray-500">{completedSales} ventas completadas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Créditos Pendientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(totalCredits)}</div>
                <p className="text-xs text-gray-500">
                  {credits.filter((c) => c.status === "pendiente").length} créditos activos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Descuento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{customer.discount_percentage}%</div>
                <p className="text-xs text-gray-500">Descuento especial</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="sales" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sales">Historial de Ventas</TabsTrigger>
              <TabsTrigger value="credits">Créditos</TabsTrigger>
            </TabsList>

            <TabsContent value="sales" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Ventas Realizadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-4">Cargando...</div>
                  ) : sales.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No hay ventas registradas</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Venta #</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Estado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sales.map((sale) => (
                            <TableRow key={sale.id}>
                              <TableCell className="font-medium">{sale.sale_number}</TableCell>
                              <TableCell>{formatDate(sale.created_at)}</TableCell>
                              <TableCell>{formatCurrency(sale.total)}</TableCell>
                              <TableCell>
                                {sale.payment_method === "efectivo" && "Efectivo"}
                                {sale.payment_method === "tarjeta" && "Tarjeta"}
                                {sale.payment_method === "transferencia" && "Transferencia"}
                                {sale.payment_method === "credito" && "Crédito"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={sale.sale_type === "credito" ? "outline" : "default"}>
                                  {sale.sale_type === "credito" ? "Crédito" : "Contado"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={sale.status === "completada" ? "default" : "secondary"}>
                                  {sale.status === "completada" ? "Completada" : "Cancelada"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="credits" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CreditCard className="h-5 w-5 mr-2" />
                    Créditos y Abonos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-4">Cargando...</div>
                  ) : credits.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No hay créditos registrados</div>
                  ) : (
                    <div className="space-y-4">
                      {credits.map((credit) => (
                        <div key={credit.id} className="border rounded-lg p-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-medium">Venta #{credit.sale.sale_number}</span>
                                <Badge variant={credit.status === "pendiente" ? "destructive" : "default"}>
                                  {credit.status === "pendiente" ? "Pendiente" : "Pagado"}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                                <div>
                                  <span className="text-gray-500">Total:</span>
                                  <div className="font-medium">{formatCurrency(credit.total_amount)}</div>
                                </div>
                                <div>
                                  <span className="text-gray-500">Pagado:</span>
                                  <div className="font-medium text-green-600">{formatCurrency(credit.paid_amount)}</div>
                                </div>
                                <div>
                                  <span className="text-gray-500">Pendiente:</span>
                                  <div className="font-medium text-red-600">
                                    {formatCurrency(credit.remaining_amount)}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-500">Vencimiento:</span>
                                  <div className="font-medium">{formatDate(credit.due_date)}</div>
                                </div>
                              </div>
                              {credit.notes && (
                                <div className="mt-2 text-sm text-gray-600">
                                  <span className="font-medium">Notas:</span> {credit.notes}
                                </div>
                              )}
                            </div>
                            {credit.status === "pendiente" && credit.remaining_amount > 0 && (
                              <Button size="sm" onClick={() => setSelectedCredit(credit)} className="whitespace-nowrap">
                                <Plus className="h-4 w-4 mr-1" />
                                Abonar
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Diálogo de pago */}
        <Dialog open={!!selectedCredit} onOpenChange={() => setSelectedCredit(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Abono</DialogTitle>
            </DialogHeader>
            {selectedCredit && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-sm text-gray-600">Venta #{selectedCredit.sale.sale_number}</div>
                  <div className="text-lg font-bold">Saldo: {formatCurrency(selectedCredit.remaining_amount)}</div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Monto del Abono</label>
                  <Input
                    type="number"
                    step="0.01"
                    max={selectedCredit.remaining_amount}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Método de Pago</label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={paymentMethod === "efectivo" ? "default" : "outline"}
                      onClick={() => setPaymentMethod("efectivo")}
                      size="sm"
                    >
                      Efectivo
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === "tarjeta" ? "default" : "outline"}
                      onClick={() => setPaymentMethod("tarjeta")}
                      size="sm"
                    >
                      Tarjeta
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === "transferencia" ? "default" : "outline"}
                      onClick={() => setPaymentMethod("transferencia")}
                      size="sm"
                    >
                      Transferencia
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Notas (opcional)</label>
                  <Input
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Notas del pago..."
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSelectedCredit(null)}>
                    Cancelar
                  </Button>
                  <Button onClick={handlePayment} disabled={!paymentAmount || Number.parseFloat(paymentAmount) <= 0}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Registrar Abono
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
