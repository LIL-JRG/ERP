"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, FileText, Printer, Plus, ArrowRight, Calendar, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import ProductSelector from "@/components/shared/product-selector"
import CustomerSelector from "@/components/shared/customer-selector"
import { PrintableDocument } from "@/components/shared/print-service"
import { Textarea } from "@/components/ui/textarea"
import { useSettings } from "@/hooks/use-settings"

interface Product {
  id: string
  name: string
  price: number
  stock_quantity: number
  barcode: string | null
}

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  discount_percentage: number
}

interface QuoteItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  total: number
}

interface Quote {
  id: string
  quote_number: string
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  subtotal: number
  tax: number
  total: number
  status: string
  valid_until: string | null
  notes: string | null
  created_at: string
  items: QuoteItem[]
  customer?: Customer | null
}

export default function QuotesManager() {
  const { settings, calculateTax, formatCurrency } = useSettings()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isNewQuoteDialogOpen, setIsNewQuoteDialogOpen] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)
  const [isViewQuoteDialogOpen, setIsViewQuoteDialogOpen] = useState(false)

  // Estado para nueva cotización
  const [newQuoteItems, setNewQuoteItems] = useState<QuoteItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [notes, setNotes] = useState("")
  const [validUntil, setValidUntil] = useState("")

  useEffect(() => {
    fetchQuotes()
    // Establecer fecha de validez por defecto
    const defaultDate = new Date()
    defaultDate.setDate(defaultDate.getDate() + settings.quote_validity_days)
    setValidUntil(defaultDate.toISOString().split("T")[0])
  }, [settings.quote_validity_days])

  const fetchQuotes = async () => {
    try {
      const { data: quotesData, error: quotesError } = await supabase
        .from("quotes")
        .select("*")
        .order("created_at", { ascending: false })

      if (quotesError) throw quotesError

      const quotesWithItems = await Promise.all(
        (quotesData || []).map(async (quote) => {
          const { data: itemsData } = await supabase.from("quote_items").select("*").eq("quote_id", quote.id)

          let customer = null
          if (quote.customer_id) {
            const { data: customerData } = await supabase
              .from("customers")
              .select("*")
              .eq("id", quote.customer_id)
              .single()

            customer = customerData
          }

          return {
            ...quote,
            items: itemsData || [],
            customer,
          }
        }),
      )

      setQuotes(quotesWithItems)
    } catch (error) {
      console.error("Error fetching quotes:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddProduct = (product: Product, quantity: number) => {
    const existingItemIndex = newQuoteItems.findIndex((item) => item.product_id === product.id)

    if (existingItemIndex >= 0) {
      const updatedItems = [...newQuoteItems]
      updatedItems[existingItemIndex].quantity += quantity
      updatedItems[existingItemIndex].total =
        updatedItems[existingItemIndex].quantity * updatedItems[existingItemIndex].unit_price
      setNewQuoteItems(updatedItems)
    } else {
      setNewQuoteItems([
        ...newQuoteItems,
        {
          product_id: product.id,
          product_name: product.name,
          quantity,
          unit_price: product.price,
          total: product.price * quantity,
        },
      ])
    }
  }

  const handleRemoveItem = (index: number) => {
    const updatedItems = [...newQuoteItems]
    updatedItems.splice(index, 1)
    setNewQuoteItems(updatedItems)
  }

  const handleUpdateItemQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return

    const updatedItems = [...newQuoteItems]
    updatedItems[index].quantity = quantity
    updatedItems[index].total = quantity * updatedItems[index].unit_price
    setNewQuoteItems(updatedItems)
  }

  const calculateSubtotal = () => {
    return newQuoteItems.reduce((sum, item) => sum + item.total, 0)
  }

  const calculateDiscount = () => {
    if (!selectedCustomer || selectedCustomer.discount_percentage <= 0) return 0
    return (calculateSubtotal() * selectedCustomer.discount_percentage) / 100
  }

  const calculateQuoteTax = () => {
    const taxableAmount = calculateSubtotal() - calculateDiscount()
    return calculateTax(taxableAmount)
  }

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscount() + calculateQuoteTax()
  }

  const resetForm = () => {
    setNewQuoteItems([])
    setSelectedCustomer(null)
    setNotes("")
    const defaultDate = new Date()
    defaultDate.setDate(defaultDate.getDate() + settings.quote_validity_days)
    setValidUntil(defaultDate.toISOString().split("T")[0])
  }

  const handleCreateQuote = async () => {
    if (newQuoteItems.length === 0) {
      alert("Agrega al menos un producto a la cotización")
      return
    }

    try {
      const subtotal = calculateSubtotal()
      const tax = calculateQuoteTax()
      const total = calculateTotal()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data: quoteData, error: quoteError } = await supabase
        .from("quotes")
        .insert([
          {
            customer_id: selectedCustomer?.id || null,
            customer_name: selectedCustomer?.name || "Cliente General",
            customer_phone: selectedCustomer?.phone || null,
            customer_email: selectedCustomer?.email || null,
            subtotal,
            tax,
            total,
            status: "pendiente",
            valid_until: validUntil || null,
            notes: notes || null,
            user_id: user?.id,
          },
        ])
        .select()

      if (quoteError) throw quoteError

      const quote = quoteData[0]

      const quoteItems = newQuoteItems.map((item) => ({
        quote_id: quote.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
      }))

      const { error: itemsError } = await supabase.from("quote_items").insert(quoteItems)

      if (itemsError) throw itemsError

      resetForm()
      setIsNewQuoteDialogOpen(false)
      await fetchQuotes()

      const createdQuote = {
        ...quote,
        items: newQuoteItems,
        customer: selectedCustomer,
      }
      setSelectedQuote(createdQuote)
      setIsViewQuoteDialogOpen(true)
    } catch (error) {
      console.error("Error creating quote:", error)
      alert("Error al crear la cotización")
    }
  }

  const handleViewQuote = (quote: Quote) => {
    setSelectedQuote(quote)
    setIsViewQuoteDialogOpen(true)
  }

  const handleConvertToSale = async (quote: Quote) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data: saleData, error: saleError } = await supabase
        .from("sales")
        .insert([
          {
            customer_id: quote.customer_id,
            customer_name: quote.customer_name,
            subtotal: quote.subtotal,
            tax: quote.tax,
            total: quote.total,
            payment_method: "efectivo",
            status: "completada",
            sale_type: "contado",
            quote_id: quote.id,
            user_id: user?.id,
          },
        ])
        .select()

      if (saleError) throw saleError

      const sale = saleData[0]

      const saleItems = quote.items.map((item) => ({
        sale_id: sale.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
      }))

      const { error: itemsError } = await supabase.from("sale_items").insert(saleItems)

      if (itemsError) throw itemsError

      const inventoryMovements = quote.items.map((item) => ({
        product_id: item.product_id,
        movement_type: "salida",
        quantity: item.quantity,
        reason: `Venta #${sale.sale_number} (desde Cotización #${quote.quote_number})`,
        reference_id: sale.id,
        user_id: user?.id,
      }))

      const { error: inventoryError } = await supabase.from("inventory_movements").insert(inventoryMovements)

      if (inventoryError) throw inventoryError

      const { error: updateError } = await supabase.from("quotes").update({ status: "convertida" }).eq("id", quote.id)

      if (updateError) throw updateError

      await fetchQuotes()
      setIsViewQuoteDialogOpen(false)

      alert(`Cotización #${quote.quote_number} convertida a venta #${sale.sale_number} exitosamente`)
    } catch (error) {
      console.error("Error converting quote to sale:", error)
      alert("Error al convertir la cotización a venta")
    }
  }

  const handleCancelQuote = async (quote: Quote) => {
    if (!confirm(`¿Estás seguro de que quieres cancelar la cotización #${quote.quote_number}?`)) {
      return
    }

    try {
      const { error: updateError } = await supabase.from("quotes").update({ status: "rechazada" }).eq("id", quote.id)

      if (updateError) throw updateError

      await fetchQuotes()
      setIsViewQuoteDialogOpen(false)

      alert(`Cotización #${quote.quote_number} cancelada exitosamente`)
    } catch (error) {
      console.error("Error canceling quote:", error)
      alert("Error al cancelar la cotización")
    }
  }

  const filteredQuotes = quotes.filter(
    (quote) =>
      quote.quote_number.includes(searchTerm) ||
      (quote.customer_name && quote.customer_name.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
    }).format(date)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pendiente":
        return <Badge className="bg-yellow-100 text-yellow-800">Pendiente</Badge>
      case "aprobada":
        return <Badge className="bg-green-100 text-green-800">Aprobada</Badge>
      case "rechazada":
        return <Badge className="bg-red-100 text-red-800">Cancelada</Badge>
      case "convertida":
        return <Badge className="bg-blue-100 text-blue-800">Convertida</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const renderQuoteDocument = (quote: Quote) => {
    return (
      <div className="print-content">
        <div className="print-header">
          <h1>{settings.business_name}</h1>
          {settings.business_address && <p>{settings.business_address}</p>}
          {settings.business_phone && <p>Tel: {settings.business_phone}</p>}
          {settings.business_email && <p>Email: {settings.business_email}</p>}
          <p>Cotización #{quote.quote_number}</p>
          <p>Fecha: {formatDate(quote.created_at)}</p>
          {quote.valid_until && <p>Válida hasta: {formatDate(quote.valid_until)}</p>}
          {quote.customer_name && <p>Cliente: {quote.customer_name}</p>}
          {quote.customer_phone && <p>Teléfono: {quote.customer_phone}</p>}
          {quote.customer_email && <p>Email: {quote.customer_email}</p>}
        </div>

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cant.</th>
              <th>Precio</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item, index) => (
              <tr key={index}>
                <td>{item.product_name}</td>
                <td>{item.quantity}</td>
                <td>{formatCurrency(item.unit_price)}</td>
                <td>{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals">
          <div>
            <strong>Subtotal:</strong> {formatCurrency(quote.subtotal)}
          </div>
          {quote.customer?.discount_percentage > 0 && (
            <div>
              <strong>Descuento ({quote.customer.discount_percentage}%):</strong>{" "}
              {formatCurrency((quote.subtotal * quote.customer.discount_percentage) / 100)}
            </div>
          )}
          {settings.tax_enabled && (
            <div>
              <strong>IVA ({settings.tax_rate}%):</strong> {formatCurrency(quote.tax)}
            </div>
          )}
          <div className="text-lg font-bold">
            <strong>Total:</strong> {formatCurrency(quote.total)}
          </div>
        </div>

        {quote.notes && (
          <div style={{ marginTop: "20px" }}>
            <strong>Notas:</strong>
            <p>{quote.notes}</p>
          </div>
        )}

        <div className="footer">
          <p>
            Esta cotización es válida hasta {quote.valid_until ? formatDate(quote.valid_until) : "la fecha indicada"}.
          </p>
          <p>Para cualquier duda o aclaración, contáctenos.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-2 md:p-6">
      <Tabs defaultValue="quotes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="quotes">Cotizaciones</TabsTrigger>
          <TabsTrigger value="new">Nueva Cotización</TabsTrigger>
        </TabsList>

        <TabsContent value="quotes" className="space-y-4">
          {/* Header con búsqueda */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar cotizaciones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* <Button onClick={() => setIsNewQuoteDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Cotización
            </Button> */}
          </div>

          {/* Tabla de cotizaciones */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cotización #</TableHead>
                      <TableHead className="hidden md:table-cell">Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="hidden lg:table-cell">Válida hasta</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4">
                          Cargando cotizaciones...
                        </TableCell>
                      </TableRow>
                    ) : filteredQuotes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4">
                          No se encontraron cotizaciones
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredQuotes.map((quote) => (
                        <TableRow key={quote.id}>
                          <TableCell>
                            <div className="font-medium">{quote.quote_number}</div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{formatDate(quote.created_at)}</TableCell>
                          <TableCell>
                            <div className="truncate max-w-32">{quote.customer_name || "Cliente General"}</div>
                            {quote.customer?.discount_percentage > 0 && (
                              <Badge className="bg-green-100 text-green-800 mt-1 text-xs">
                                {quote.customer.discount_percentage}% desc.
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{formatCurrency(quote.total)}</div>
                            <div className="text-xs text-gray-500">
                              {quote.items.length} {quote.items.length === 1 ? "item" : "items"}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(quote.status)}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {quote.valid_until ? formatDate(quote.valid_until) : "Sin fecha"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleViewQuote(quote)}>
                                <Printer className="h-4 w-4" />
                              </Button>
                              {quote.status === "pendiente" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleConvertToSale(quote)}
                                    title="Convertir a venta"
                                  >
                                    <ArrowRight className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCancelQuote(quote)}
                                    className="text-red-600"
                                    title="Cancelar cotización"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="new" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Nueva Cotización</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Selección de cliente */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Cliente</h3>
                <CustomerSelector onCustomerSelect={setSelectedCustomer} selectedCustomer={selectedCustomer} />
              </div>

              {/* Selección de productos */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Productos</h3>
                <ProductSelector
                  onProductSelect={handleAddProduct}
                  excludeProductIds={newQuoteItems.map((item) => item.product_id)}
                  isQuote={true}
                />

                {newQuoteItems.length > 0 ? (
                  <div className="border rounded-md overflow-hidden mt-4">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead className="w-32">Cantidad</TableHead>
                            <TableHead className="hidden sm:table-cell">Precio</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {newQuoteItems.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <div className="truncate max-w-32">{item.product_name}</div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleUpdateItemQuantity(index, item.quantity - 1)}
                                    disabled={item.quantity <= 1}
                                  >
                                    -
                                  </Button>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      handleUpdateItemQuantity(index, Number.parseInt(e.target.value) || 1)
                                    }
                                    className="h-8 w-12 mx-1 text-center p-1"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleUpdateItemQuantity(index, item.quantity + 1)}
                                  >
                                    +
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">{formatCurrency(item.unit_price)}</TableCell>
                              <TableCell>{formatCurrency(item.total)}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveItem(index)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 border rounded-md text-gray-500">
                    No hay productos agregados a la cotización
                  </div>
                )}
              </div>

              {/* Fecha de validez y notas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Válida hasta</h3>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Notas</h3>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas adicionales para la cotización..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Resumen */}
              {newQuoteItems.length > 0 && (
                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(calculateSubtotal())}</span>
                  </div>
                  {selectedCustomer && selectedCustomer.discount_percentage > 0 && (
                    <div className="flex justify-between text-sm mb-1 text-green-600">
                      <span>Descuento ({selectedCustomer.discount_percentage}%):</span>
                      <span>-{formatCurrency(calculateDiscount())}</span>
                    </div>
                  )}
                  {settings.tax_enabled && (
                    <div className="flex justify-between text-sm mb-1">
                      <span>IVA ({settings.tax_rate}%):</span>
                      <span>{formatCurrency(calculateQuoteTax())}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg mt-2">
                    <span>Total:</span>
                    <span>{formatCurrency(calculateTotal())}</span>
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
                <Button variant="outline" onClick={resetForm} className="w-full sm:w-auto">
                  Limpiar
                </Button>
                <Button onClick={handleCreateQuote} disabled={newQuoteItems.length === 0} className="w-full sm:w-auto">
                  <FileText className="h-4 w-4 mr-2" />
                  Crear Cotización
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo para ver/imprimir cotización */}
      <Dialog open={isViewQuoteDialogOpen} onOpenChange={setIsViewQuoteDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cotización #{selectedQuote?.quote_number}</DialogTitle>
          </DialogHeader>
          {selectedQuote && (
            <div className="space-y-4">
              <div className="border rounded-md p-4">{renderQuoteDocument(selectedQuote)}</div>
              <div className="flex flex-col sm:flex-row justify-between gap-2">
                <div>
                  {selectedQuote.status === "pendiente" && (
                    <>
                      <Button onClick={() => handleConvertToSale(selectedQuote)} className="mr-2 mb-2 sm:mb-0">
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Convertir a Venta
                      </Button>
                      <Button onClick={() => handleCancelQuote(selectedQuote)} variant="destructive" size="sm">
                        <X className="h-4 w-4 mr-2" />
                        Cancelar Cotización
                      </Button>
                    </>
                  )}
                </div>
                <PrintableDocument
                  title={`Cotización #${selectedQuote.quote_number}`}
                  content={renderQuoteDocument(selectedQuote)}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
