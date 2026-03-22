"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, FileText, Printer, Plus, ArrowRight, Calendar, X, Users, Trash2, Percent, AlertCircle, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import ProductSelector from "@/components/shared/product-selector"
import CustomerSelector from "@/components/shared/customer-selector"
import { PrintableDocument } from "@/components/shared/print-service"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useSettings } from "@/hooks/use-settings"

interface ProductVariant {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  public_price: number
  wholesale_price: number
  stock_quantity: number
  min_stock: number
  is_active: boolean
}

interface Product {
  id: string
  name: string
  barcode: string | null
  public_price: number
  wholesale_price: number
  stock_quantity: number
  category: string
  brand: string
  has_variants: boolean
  variants?: ProductVariant[]
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

  const totalQuotes = quotes.length
  const pendingQuotes = quotes.filter((q) => q.status === "pendiente").length
  const convertedQuotes = quotes.filter((q) => q.status === "convertida").length
  const canceledQuotes = quotes.filter((q) => q.status === "rechazada").length

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

  const handleAddProduct = (
    product: Product, 
    quantity: number, 
    variant?: ProductVariant, 
    priceType: "public" | "wholesale" = "public"
  ) => {
    const itemPrice = variant 
      ? (priceType === "wholesale" ? variant.wholesale_price : variant.public_price)
      : (priceType === "wholesale" ? product.wholesale_price : product.public_price)

    const productId = variant ? `${product.id}-${variant.id}` : product.id
    const productName = variant ? `${product.name} (${variant.name})` : product.name

    const existingItemIndex = newQuoteItems.findIndex((item) => item.product_id === productId)

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
          product_id: productId,
          product_name: productName,
          quantity,
          unit_price: itemPrice,
          total: itemPrice * quantity,
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
          {quote.customer && quote.customer.discount_percentage > 0 && (
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

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] gap-6 animate-pulse">
        <div className="w-20 h-20 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-2xl font-black text-slate-300 uppercase tracking-tighter italic">Sincronizando Proyecciones...</p>
      </div>
    )
  }

  return (
    <div className="space-y-12 p-6 md:p-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      {/* Massive Big UI Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-4">
        <div>
          <h1 className="text-7xl md:text-8xl font-black tracking-tighter text-slate-900 leading-[0.8] mb-4">
            Cotizaciones<span className="text-emerald-500">.</span>
          </h1>
          <p className="text-xl font-bold text-slate-400 uppercase tracking-widest italic ml-1">
            Proyecciones Comerciales y presupuestos
          </p>
        </div>
      </div>

      {/* Premium Quote Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="rounded-[32px] border-none shadow-sm bg-white p-8 group hover:shadow-xl transition-all duration-500">
          <div className="flex justify-between items-start mb-6">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 group-hover:scale-110 transition-transform">
              <FileText className="h-7 w-7" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Total Emitidas</p>
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter italic">{totalQuotes}</h3>
          </div>
        </Card>

        <Card className="rounded-[32px] border-none shadow-sm bg-white p-8 group hover:shadow-xl transition-all duration-500">
          <div className="flex justify-between items-start mb-6">
            <div className="w-14 h-14 bg-yellow-50 rounded-2xl flex items-center justify-center text-yellow-600 group-hover:scale-110 transition-transform">
              <Calendar className="h-7 w-7" />
            </div>
            <Badge className="bg-yellow-50 text-yellow-600 border-none font-black px-3 py-1 rounded-full uppercase text-[10px] tracking-widest italic">Activas</Badge>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">En Espera</p>
            <h3 className="text-4xl font-black text-yellow-600 tracking-tighter italic">{pendingQuotes}</h3>
          </div>
        </Card>

        <Card className="rounded-[32px] border-none shadow-sm bg-white p-8 group hover:shadow-xl transition-all duration-500 border-l-4 border-l-emerald-500">
          <div className="flex justify-between items-start mb-6">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <ArrowRight className="h-7 w-7" />
            </div>
            <Badge className="bg-emerald-50 text-emerald-600 border-none font-black px-3 py-1 rounded-full uppercase text-[10px] tracking-widest italic">Éxito</Badge>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Convertidas</p>
            <h3 className="text-4xl font-black text-emerald-600 tracking-tighter italic">{convertedQuotes}</h3>
          </div>
        </Card>

        <Card className="rounded-[32px] border-none shadow-sm bg-white p-8 group hover:shadow-xl transition-all duration-500">
          <div className="flex justify-between items-start mb-6">
            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform">
              <X className="h-7 w-7" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Rechazadas</p>
            <h3 className="text-4xl font-black text-rose-600 tracking-tighter italic">{canceledQuotes}</h3>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="quotes" className="space-y-8">
        <TabsList className="h-20 p-2 bg-white rounded-[28px] shadow-sm border border-slate-50 gap-2 w-fit">
          <TabsTrigger 
            value="quotes" 
            className="h-full px-10 rounded-[22px] data-[state=active]:bg-slate-900 data-[state=active]:text-white font-black uppercase tracking-widest text-[10px] transition-all duration-500"
          >
            Historial de Proyecciones
          </TabsTrigger>
          <TabsTrigger 
            value="new" 
            className="h-full px-10 rounded-[22px] data-[state=active]:bg-emerald-500 data-[state=active]:text-white font-black uppercase tracking-widest text-[10px] transition-all duration-500"
          >
            Generar Cotización
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotes" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Search Header */}
          <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
            <div className="relative w-full md:w-[450px] group">
              <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                <Search className="h-6 w-6 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
              </div>
              <Input
                placeholder="BUSCAR POR FOLIO O CLIENTE..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-16 pl-16 rounded-[24px] border-none bg-white shadow-sm font-black text-sm uppercase tracking-widest placeholder:text-slate-300 focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all text-slate-900"
              />
            </div>
            <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] italic pr-4">
              VISUALIZANDO {filteredQuotes.length} DOCUMENTOS
            </div>
          </div>

          {/* Quotes Table Big UI */}
          <div className="bg-white rounded-[44px] shadow-sm overflow-hidden p-4 border border-slate-50">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-50 hover:bg-transparent">
                    <TableHead className="h-20 px-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">FOLIO / REFERENCIA</TableHead>
                    <TableHead className="h-20 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] hidden md:table-cell">FECHA EMISIÓN</TableHead>
                    <TableHead className="h-20 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">CLIENTE DESTINO</TableHead>
                    <TableHead className="h-20 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">VALOR TOTAL</TableHead>
                    <TableHead className="h-20 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">ESTADO</TableHead>
                    <TableHead className="h-20 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] hidden lg:table-cell">EXPIRACIÓN</TableHead>
                    <TableHead className="h-20 px-8 text-right text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">OPERACIONES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.map((quote) => (
                    <TableRow key={quote.id} className="group border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <TableCell className="px-8 py-8">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-lg italic shadow-lg shadow-slate-900/10">
                            #
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xl font-black text-slate-900 uppercase tracking-tight">{quote.quote_number}</span>
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic leading-none">REF: {quote.id.split('-')[0]}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-8 hidden md:table-cell text-xs font-black text-slate-400 uppercase tracking-widest italic">
                        {formatDate(quote.created_at)}
                      </TableCell>
                      <TableCell className="py-8">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{quote.customer_name || "CLIENTE GENERAL"}</span>
                          {quote.customer && quote.customer.discount_percentage > 0 && (
                            <Badge className="bg-emerald-50 text-emerald-600 border-none font-black px-2 py-0.5 rounded-md uppercase text-[8px] tracking-[0.2em] w-fit">
                              VIP {quote.customer.discount_percentage}%
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-8">
                        <div className="flex flex-col">
                          <span className="text-2xl font-black text-slate-900 tracking-tighter italic">{formatCurrency(quote.total)}</span>
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">{quote.items.length} POSICIONES</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-8">
                        {getStatusBadge(quote.status)}
                      </TableCell>
                      <TableCell className="py-8 hidden lg:table-cell text-xs font-black text-slate-300 uppercase tracking-widest italic">
                        {quote.valid_until ? formatDate(quote.valid_until) : "INDETERMINADA"}
                      </TableCell>
                      <TableCell className="px-8 py-8 text-right">
                        <div className="flex justify-end gap-3">
                          <Button 
                            variant="ghost" 
                            onClick={() => handleViewQuote(quote)}
                            className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 hover:bg-slate-900 hover:text-white transition-all p-0"
                          >
                            <Printer className="h-5 w-5" />
                          </Button>
                          {quote.status === "pendiente" && (
                            <>
                              <Button
                                variant="ghost"
                                onClick={() => handleConvertToSale(quote)}
                                className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-500 hover:text-white transition-all p-0"
                                title="Convertir a venta"
                              >
                                <ArrowRight className="h-5 w-5" />
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => handleCancelQuote(quote)}
                                className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 border border-rose-100 hover:bg-rose-500 hover:text-white transition-all p-0"
                                title="Rechazar"
                              >
                                <X className="h-5 w-5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="new" className="animate-in fade-in slide-in-from-right-4 duration-700">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
            {/* Formulario Principal */}
            <div className="lg:col-span-2 space-y-8">
              <h2 className="text-5xl font-black text-slate-900 tracking-tighter italic mb-10">
                Nueva Operación<span className="text-emerald-500">.</span>
              </h2>

              <div className="bg-white rounded-[40px] shadow-sm p-10 space-y-10 border border-slate-50">
                {/* Selección de Cliente */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 ml-1 mb-2">
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                      <Users className="h-5 w-5" />
                    </div>
                    <Label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Titular del Presupuesto</Label>
                  </div>
                  <CustomerSelector onCustomerSelect={setSelectedCustomer} selectedCustomer={selectedCustomer} />
                </div>

                {/* Selección de Productos */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 ml-1">
                    <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                      <Plus className="h-5 w-5" />
                    </div>
                    <Label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Desglose de Productos / Servicios</Label>
                  </div>
                  
                  <ProductSelector
                    onProductSelect={handleAddProduct}
                    excludeProductIds={newQuoteItems.map((item) => item.product_id)}
                  />

                  {newQuoteItems.length > 0 ? (
                    <div className="bg-slate-50/50 rounded-[32px] overflow-hidden border border-slate-100 mt-4">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-100 hover:bg-transparent">
                            <TableHead className="h-16 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">PRODUCTO</TableHead>
                            <TableHead className="h-16 text-[10px] font-black text-slate-400 uppercase tracking-widest w-40">CANTIDAD</TableHead>
                            <TableHead className="h-16 text-[10px] font-black text-slate-400 uppercase tracking-widest">UNITARIO</TableHead>
                            <TableHead className="h-16 text-[10px] font-black text-slate-400 uppercase tracking-widest">SUBTOTAL</TableHead>
                            <TableHead className="h-16 px-6 w-20"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {newQuoteItems.map((item, index) => (
                            <TableRow key={index} className="border-slate-100 hover:bg-white transition-colors">
                              <TableCell className="px-6 py-6 font-black text-slate-900 uppercase tracking-tight italic">
                                {item.product_name}
                              </TableCell>
                              <TableCell className="py-4">
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-10 w-10 rounded-xl bg-white border border-slate-100 shadow-sm hover:bg-slate-900 hover:text-white"
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
                                    className="h-10 w-16 text-center font-black rounded-xl border-none bg-white shadow-sm"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-10 w-10 rounded-xl bg-white border border-slate-100 shadow-sm hover:bg-slate-900 hover:text-white"
                                    onClick={() => handleUpdateItemQuantity(index, item.quantity + 1)}
                                  >
                                    +
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell className="py-4 font-bold text-slate-500 uppercase tracking-tighter italic">
                                {formatCurrency(item.unit_price)}
                              </TableCell>
                              <TableCell className="py-4 font-black text-slate-900 tracking-tighter italic text-lg">
                                {formatCurrency(item.total)}
                              </TableCell>
                              <TableCell className="px-6 py-4 text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveItem(index)}
                                  className="h-10 w-10 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-24 bg-slate-50/50 rounded-[40px] border-2 border-dashed border-slate-100">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-200 mb-4 shadow-sm">
                        <Plus className="h-8 w-8" />
                      </div>
                      <p className="text-xl font-black text-slate-300 uppercase tracking-tighter italic">Seleccione items para cotizar</p>
                    </div>
                  )}
                </div>

                {/* Fecha y Notas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <Label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Vencimiento de Oferta</Label>
                    <div className="relative group">
                      <Calendar className="absolute left-6 top-1/2 transform -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors h-5 w-5" />
                      <Input
                        type="date"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                        className="h-16 pl-14 rounded-2xl border-none bg-slate-50 font-black text-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Observaciones</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Condiciones especiales, tiempos de entrega..."
                      className="rounded-2xl border-none bg-slate-50 p-6 min-h-[64px] font-bold focus-visible:ring-2 focus-visible:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar de Resumen Sticky */}
            <div className="lg:sticky lg:top-8 space-y-6">
              <Card className="rounded-[40px] border-none shadow-2xl bg-slate-900 text-white overflow-hidden">
                <div className="p-10 space-y-8">
                  <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500">Liquidación Proyectada</p>
                    <h3 className="text-4xl font-black italic tracking-tighter leading-none">Checkout<span className="text-emerald-500">.</span></h3>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/10">
                    <div className="flex justify-between items-center group">
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Bruto Total</span>
                      <span className="text-xl font-black italic tracking-tighter">{formatCurrency(calculateSubtotal())}</span>
                    </div>
                    
                    {selectedCustomer && selectedCustomer.discount_percentage > 0 && (
                      <div className="flex justify-between items-center text-emerald-400">
                        <span className="text-sm font-bold uppercase tracking-widest flex items-center">
                          <Percent className="h-3 w-3 mr-2" />
                          Descuento VIP ({selectedCustomer.discount_percentage}%)
                        </span>
                        <span className="text-xl font-black italic tracking-tighter">-{formatCurrency(calculateDiscount())}</span>
                      </div>
                    )}

                    {settings.tax_enabled && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-400 uppercase tracking-widest italic">Impuestos ({settings.tax_rate}%)</span>
                        <span className="text-xl font-black italic tracking-tighter">{formatCurrency(calculateQuoteTax())}</span>
                      </div>
                    )}

                    <div className="pt-8 mt-4 border-t border-white/10">
                      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-500 mb-2">Neto Sugerido</p>
                      <div className="text-6xl font-black italic tracking-tighter text-emerald-500 leading-none">
                        {formatCurrency(calculateTotal())}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-10">
                    <Button 
                      onClick={handleCreateQuote}
                      disabled={newQuoteItems.length === 0}
                      className="w-full h-20 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-emerald-500/20 group transition-all"
                    >
                      <FileText className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
                      Emitir Presupuesto
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={resetForm}
                      className="w-full h-14 rounded-2xl border border-white/10 text-white/50 hover:bg-white/5 hover:text-white font-black uppercase tracking-widest text-[10px]"
                    >
                      Abortar Operación
                    </Button>
                  </div>
                </div>
                
                {/* Visual Security Element */}
                <div className="bg-white/5 p-6 flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white italic">Documento Legal</span>
                    <span className="text-[9px] font-bold text-slate-500 leading-tight">Sujeto a cambios según políticas de stock.</span>
                  </div>
                </div>
              </Card>

              {/* Tips de Cotización */}
              <div className="bg-emerald-50 rounded-[32px] p-8 border border-emerald-100 flex items-start gap-4">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shrink-0">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-emerald-900 uppercase tracking-widest italic leading-none">Maximiza Ventas</h4>
                  <p className="text-[11px] font-bold text-emerald-700/70 leading-relaxed uppercase tracking-tight">Establecer fechas cortas de validez incentiva cierres rápidos.</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Diálogo para ver/imprimir cotización Big UI */}
      <Dialog open={isViewQuoteDialogOpen} onOpenChange={setIsViewQuoteDialogOpen}>
        <DialogContent className="max-w-5xl rounded-[44px] border-none shadow-2xl p-10 overflow-hidden bg-white">
          <DialogHeader className="mb-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle className="text-4xl font-black text-slate-900 tracking-tighter italic leading-none mb-2">
                  Cotización #{selectedQuote?.quote_number}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Documento Proyectado / Portafolio</p>
                </div>
              </div>
              {selectedQuote && getStatusBadge(selectedQuote.status)}
            </div>
          </DialogHeader>
          
          {selectedQuote && (
            <div className="space-y-8 animate-in zoom-in-95 focus-in duration-500">
              <div className="bg-slate-50 rounded-[40px] p-1 border border-slate-100/50 shadow-inner">
                 <div className="bg-white rounded-[39px] p-10 shadow-sm min-h-[500px]">
                    {renderQuoteDocument(selectedQuote)}
                 </div>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-between items-center gap-6 pt-4 border-t border-slate-50">
                <div className="flex items-center gap-4">
                  {selectedQuote.status === "pendiente" && (
                    <>
                      <Button 
                        onClick={() => handleConvertToSale(selectedQuote)} 
                        className="h-16 px-10 rounded-2xl bg-slate-900 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-slate-900/10 group"
                      >
                        <ArrowRight className="h-5 w-5 mr-3 group-hover:translate-x-1 transition-transform" />
                        Formalizar a Venta
                      </Button>
                      <Button 
                        onClick={() => handleCancelQuote(selectedQuote)} 
                        variant="ghost" 
                        className="h-16 px-8 rounded-2xl text-rose-500 hover:bg-rose-50 font-black uppercase tracking-widest text-xs"
                      >
                        Descartar Oferta
                      </Button>
                    </>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <PrintableDocument
                    title={`Cotización #${selectedQuote.quote_number}`}
                    content={renderQuoteDocument(selectedQuote)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsViewQuoteDialogOpen(false)}
                    className="h-16 w-16 rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                  >
                    <X className="h-6 w-6" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
