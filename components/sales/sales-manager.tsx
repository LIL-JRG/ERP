"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, ShoppingCart, Printer, Plus, X, CreditCard, Calendar, DollarSign } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import ProductSelector from "@/components/shared/product-selector"
import CustomerSelector from "@/components/shared/customer-selector"
import { PrintableDocument } from "@/components/shared/print-service"
import { useSettings } from "@/hooks/use-settings"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import CashCut from "@/components/cash/cash-cut"
import { cn } from "@/lib/utils"

interface ProductVariant {
  id: string
  name: string
  public_price: number
  wholesale_price: number
  stock_quantity: number
}

interface Product {
  id: string
  name: string
  public_price: number
  wholesale_price: number
  stock_quantity: number
  barcode: string | null
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

interface SaleItem {
  product_id: string
  product_name: string
  variant_id?: string
  variant_name?: string
  quantity: number
  unit_price: number
  total: number
  price_type: "public" | "wholesale"
}

interface Sale {
  id: string
  sale_number: string
  customer_id: string | null
  customer_name: string | null
  subtotal: number
  tax: number
  total: number
  amount_paid: number | null
  change_amount: number
  payment_method: string
  status: string
  sale_type: string
  created_at: string
  items: SaleItem[]
  customer?: Customer | null
  quote_id?: string | null
}

export default function SalesManager() {
  const { settings, calculateTax, formatCurrency } = useSettings()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isNewSaleDialogOpen, setIsNewSaleDialogOpen] = useState(false)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [isViewSaleDialogOpen, setIsViewSaleDialogOpen] = useState(false)

  // Estado para nueva venta
  const [newSaleItems, setNewSaleItems] = useState<SaleItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [paymentMethod, setPaymentMethod] = useState("efectivo")
  const [saleType, setSaleType] = useState<"contado" | "credito">("contado")
  const [creditNotes, setCreditNotes] = useState("")
  const [creditDueDate, setCreditDueDate] = useState("")

  // Estados para el cálculo de cambio
  const [amountPaid, setAmountPaid] = useState("")
  const [showChangeCalculator, setShowChangeCalculator] = useState(false)

  useEffect(() => {
    fetchSales()
    const defaultDate = new Date()
    defaultDate.setDate(defaultDate.getDate() + 30)
    setCreditDueDate(defaultDate.toISOString().split("T")[0])
  }, [])

  const fetchSales = async () => {
    try {
      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false })

      if (salesError) throw salesError

      const salesWithItems = await Promise.all(
        (salesData || []).map(async (sale) => {
          const { data: itemsData } = await supabase.from("sale_items").select("*").eq("sale_id", sale.id)

          let customer = null
          if (sale.customer_id) {
            const { data: customerData } = await supabase
              .from("customers")
              .select("*")
              .eq("id", sale.customer_id)
              .single()

            customer = customerData
          }

          return {
            ...sale,
            items: itemsData || [],
            customer,
          }
        }),
      )

      setSales(salesWithItems)
    } catch (error) {
      console.error("Error fetching sales:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddProduct = (
    product: Product,
    quantity: number,
    variant?: ProductVariant,
    priceType: "public" | "wholesale" = "public",
  ) => {
    const productId = product.id
    const variantId = variant?.id
    const itemKey = `${productId}-${variantId || "no-variant"}-${priceType}`

    // Buscar si ya existe este item exacto (mismo producto, variante y tipo de precio)
    const existingItemIndex = newSaleItems.findIndex(
      (item) => item.product_id === productId && item.variant_id === variantId && item.price_type === priceType,
    )

    const unitPrice = variant
      ? priceType === "wholesale"
        ? variant.wholesale_price
        : variant.public_price
      : priceType === "wholesale"
        ? product.wholesale_price
        : product.public_price

    if (existingItemIndex >= 0) {
      // Actualizar cantidad si ya existe
      const updatedItems = [...newSaleItems]
      updatedItems[existingItemIndex].quantity += quantity
      updatedItems[existingItemIndex].total =
        updatedItems[existingItemIndex].quantity * updatedItems[existingItemIndex].unit_price
      setNewSaleItems(updatedItems)
    } else {
      // Agregar nuevo item
      const newItem: SaleItem = {
        product_id: productId,
        product_name: product.name,
        variant_id: variantId,
        variant_name: variant?.name,
        quantity,
        unit_price: unitPrice,
        total: unitPrice * quantity,
        price_type: priceType,
      }
      setNewSaleItems([...newSaleItems, newItem])
    }
  }

  const handleRemoveItem = (index: number) => {
    const updatedItems = [...newSaleItems]
    updatedItems.splice(index, 1)
    setNewSaleItems(updatedItems)
  }

  const handleUpdateItemQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return

    const updatedItems = [...newSaleItems]
    updatedItems[index].quantity = quantity
    updatedItems[index].total = quantity * updatedItems[index].unit_price
    setNewSaleItems(updatedItems)
  }

  const handleToggleItemPriceType = async (index: number) => {
    const updatedItems = [...newSaleItems]
    const item = updatedItems[index]

    // Get the product data to access current prices
    try {
      let newPrice = 0

      if (item.variant_id) {
        // Get variant price
        const { data: variantData } = await supabase
          .from("product_variants")
          .select("public_price, wholesale_price")
          .eq("id", item.variant_id)
          .single()

        if (variantData) {
          newPrice = item.price_type === "public" ? variantData.wholesale_price : variantData.public_price
        }
      } else {
        // Get product price
        const { data: productData } = await supabase
          .from("products")
          .select("public_price, wholesale_price")
          .eq("id", item.product_id)
          .single()

        if (productData) {
          newPrice = item.price_type === "public" ? productData.wholesale_price : productData.public_price
        }
      }

      // Update the item with new price type and price
      updatedItems[index].price_type = item.price_type === "public" ? "wholesale" : "public"
      updatedItems[index].unit_price = newPrice
      updatedItems[index].total = updatedItems[index].quantity * newPrice

      setNewSaleItems(updatedItems)
    } catch (error) {
      console.error("Error updating price:", error)
    }
  }

  const calculateSubtotal = () => {
    return newSaleItems.reduce((sum, item) => sum + item.total, 0)
  }

  const calculateDiscount = () => {
    if (!selectedCustomer || selectedCustomer.discount_percentage <= 0) return 0
    return (calculateSubtotal() * selectedCustomer.discount_percentage) / 100
  }

  const calculateSaleTax = () => {
    const taxableAmount = calculateSubtotal() - calculateDiscount()
    return calculateTax(taxableAmount)
  }

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscount() + calculateSaleTax()
  }

  const calculateChange = () => {
    const total = calculateTotal()
    const paid = Number.parseFloat(amountPaid) || 0
    return Math.max(0, paid - total)
  }

  const handleCreateSale = async () => {
    if (newSaleItems.length === 0) {
      alert("Agrega al menos un producto a la venta")
      return
    }

    if (saleType === "credito" && !selectedCustomer) {
      alert("Debes seleccionar un cliente para ventas a crédito")
      return
    }

    // Validate payment for cash sales
    if (saleType === "contado") {
      const total = calculateTotal()
      const paid = Number.parseFloat(amountPaid) || 0

      if (!amountPaid || paid <= 0) {
        alert("Ingresa el monto pagado")
        return
      }

      if (paymentMethod === "efectivo" && paid < total) {
        alert(`El monto pagado (${formatCurrency(paid)}) es menor al total (${formatCurrency(total)})`)
        return
      }
    }

    try {
      const subtotal = calculateSubtotal()
      const tax = calculateSaleTax()
      const total = calculateTotal()
      const paid = saleType === "contado" ? Number.parseFloat(amountPaid) || total : 0
      const change = saleType === "contado" && paymentMethod === "efectivo" ? Math.max(0, paid - total) : 0

      const {
        data: { user },
      } = await supabase.auth.getUser()

      // 1. Create the sale
      const { data: saleData, error: saleError } = await supabase
        .from("sales")
        .insert([
          {
            customer_id: selectedCustomer?.id || null,
            customer_name: selectedCustomer?.name || "Cliente General",
            subtotal,
            tax,
            total,
            amount_paid: paid,
            change_amount: change,
            payment_method: saleType === "credito" ? "credito" : paymentMethod,
            status: "completada",
            sale_type: saleType,
            user_id: user?.id,
          },
        ])
        .select()

      if (saleError) throw saleError

      const sale = saleData[0]

      // 2. Create sale items
      const saleItems = newSaleItems.map((item) => ({
        sale_id: sale.id,
        product_id: item.product_id,
        product_name: item.product_name,
        variant_id: item.variant_id || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        price_type: item.price_type,
      }))

      const { error: itemsError } = await supabase.from("sale_items").insert(saleItems)

      if (itemsError) throw itemsError

      // 3. Update inventory
      const inventoryMovements = newSaleItems.map((item) => ({
        product_id: item.product_id,
        movement_type: "salida",
        quantity: item.quantity,
        reason: `Venta #${sale.sale_number}`,
        reference_id: sale.id,
        user_id: user?.id,
      }))

      const { error: inventoryError } = await supabase.from("inventory_movements").insert(inventoryMovements)

      if (inventoryError) throw inventoryError

      // 4. Handle credit sales
      if (saleType === "credito" && selectedCustomer) {
        const { error: creditError } = await supabase.from("customer_credits").insert([
          {
            customer_id: selectedCustomer.id,
            sale_id: sale.id,
            total_amount: total,
            remaining_amount: total,
            due_date: creditDueDate,
            notes: creditNotes,
          },
        ])

        if (creditError) throw creditError
      }

      // 5. Clean up form
      resetForm()
      setIsNewSaleDialogOpen(false)

      // 6. Reload sales
      await fetchSales()

      // 7. Show created sale
      const createdSale = {
        ...sale,
        items: newSaleItems,
        customer: selectedCustomer,
      }
      setSelectedSale(createdSale)
      setIsViewSaleDialogOpen(true)
    } catch (error) {
      console.error("Error creating sale:", error)
      alert("Error al crear la venta")
    }
  }

  const resetForm = () => {
    setNewSaleItems([])
    setSelectedCustomer(null)
    setPaymentMethod("efectivo")
    setSaleType("contado")
    setCreditNotes("")
    setAmountPaid("")
    setShowChangeCalculator(false)
    const defaultDate = new Date()
    defaultDate.setDate(defaultDate.getDate() + 30)
    setCreditDueDate(defaultDate.toISOString().split("T")[0])
  }

  const handleViewSale = (sale: Sale) => {
    setSelectedSale(sale)
    setIsViewSaleDialogOpen(true)
  }

  const handleCancelSale = async (sale: Sale) => {
    if (
      !confirm(
        `¿Estás seguro de que quieres cancelar la venta #${sale.sale_number}? Esto revertirá los movimientos de inventario.`,
      )
    ) {
      return
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // 1. Actualizar el estado de la venta
      const { error: updateError } = await supabase.from("sales").update({ status: "cancelada" }).eq("id", sale.id)

      if (updateError) throw updateError

      // 2. Revertir inventario
      const inventoryMovements = sale.items.map((item) => ({
        product_id: item.product_id,
        movement_type: "entrada",
        quantity: item.quantity,
        reason: `Cancelación de Venta #${sale.sale_number}`,
        reference_id: sale.id,
        user_id: user?.id,
      }))

      const { error: inventoryError } = await supabase.from("inventory_movements").insert(inventoryMovements)

      if (inventoryError) throw inventoryError

      // 3. Si tenía crédito asociado, cancelarlo
      if (sale.sale_type === "credito") {
        const { error: creditError } = await supabase
          .from("customer_credits")
          .update({ status: "cancelado" })
          .eq("sale_id", sale.id)

        if (creditError) throw creditError
      }

      // 4. Si venía de cotización, revertir estado
      if (sale.quote_id) {
        const { error: quoteError } = await supabase
          .from("quotes")
          .update({ status: "pendiente" })
          .eq("id", sale.quote_id)

        if (quoteError) throw quoteError
      }

      await fetchSales()
      setIsViewSaleDialogOpen(false)

      alert(`Venta #${sale.sale_number} cancelada exitosamente.`)
    } catch (error) {
      console.error("Error canceling sale:", error)
      alert("Error al cancelar la venta")
    }
  }

  const filteredSales = sales.filter(
    (sale) =>
      sale.sale_number.includes(searchTerm) ||
      (sale.customer_name && sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date)
  }

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case "efectivo":
        return "Efectivo"
      case "tarjeta":
        return "Tarjeta"
      case "transferencia":
        return "Transferencia"
      case "credito":
        return "Crédito"
      default:
        return method
    }
  }

  const renderSaleTicket = (sale: Sale) => {
    return (
      <div className="print-content">
        <div className="print-header">
          <h1>{settings.business_name}</h1>
          {settings.business_address && <p>{settings.business_address}</p>}
          {settings.business_phone && <p>Tel: {settings.business_phone}</p>}
          {settings.business_email && <p>Email: {settings.business_email}</p>}
          <p>Ticket de Venta #{sale.sale_number}</p>
          <p>Fecha: {formatDate(sale.created_at)}</p>
          {sale.customer_name && <p>Cliente: {sale.customer_name}</p>}
          {sale.sale_type === "credito" && (
            <p>
              <strong>VENTA A CRÉDITO</strong>
            </p>
          )}
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
            {sale.items.map((item, index) => (
              <tr key={index}>
                <td>
                  {item.product_name}
                  {item.variant_name && <div className="text-xs text-gray-500">{item.variant_name}</div>}
                  <div className="text-xs text-blue-500">
                    {item.price_type === "wholesale" ? "Precio Puesto" : "Precio Público"}
                  </div>
                </td>
                <td>{item.quantity}</td>
                <td>{formatCurrency(item.unit_price)}</td>
                <td>{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals">
          <div>
            <strong>Subtotal:</strong> {formatCurrency(sale.subtotal)}
          </div>
          {sale.customer?.discount_percentage && sale.customer.discount_percentage > 0 && (
            <div>
              <strong>Descuento ({sale.customer.discount_percentage}%):</strong>{" "}
              {formatCurrency((sale.subtotal * sale.customer.discount_percentage) / 100)}
            </div>
          )}
          {settings.tax_enabled && (
            <div>
              <strong>IVA ({settings.tax_rate}%):</strong> {formatCurrency(sale.tax)}
            </div>
          )}
          <div className="text-lg font-bold">
            <strong>TOTAL:</strong> {formatCurrency(sale.total)}
          </div>

          {/* Payment Information */}
          <div style={{ marginTop: "15px", borderTop: "1px solid #ddd", paddingTop: "10px" }}>
            <div>
              <strong>Método de pago:</strong> {getPaymentMethodText(sale.payment_method)}
            </div>
            {sale.amount_paid && (
              <div>
                <strong>Monto pagado:</strong> {formatCurrency(sale.amount_paid)}
              </div>
            )}
            {sale.change_amount > 0 && (
              <div>
                <strong>Cambio:</strong> {formatCurrency(sale.change_amount)}
              </div>
            )}
          </div>
        </div>

        <div className="footer">
          <p>¡Gracias por su compra!</p>
          <p>Para cualquier duda o aclaración, contáctenos.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-12 p-6 md:p-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      {/* Massive Big UI Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-4">
        <div>
          <h1 className="text-7xl md:text-8xl font-black tracking-tighter text-slate-900 leading-[0.8] mb-4">
            Ventas<span className="text-emerald-500">.</span>
          </h1>
          <p className="text-xl font-bold text-slate-400 uppercase tracking-widest italic ml-1">
            Gestión de Transacciones y Flujo de Caja
          </p>
        </div>
        <div className="flex items-center gap-4">
          <CashCut />
        </div>
      </div>

      {/* Premium Sales Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-[32px] border-none shadow-sm bg-white p-8 group hover:shadow-xl transition-all duration-500">
          <div className="flex justify-between items-start mb-6">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <DollarSign className="h-7 w-7" />
            </div>
            <Badge className="bg-emerald-50 text-emerald-600 border-none font-black px-3 py-1 rounded-full uppercase text-[10px] tracking-widest italic">Facturación</Badge>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Total Ventas</p>
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter italic">
              {formatCurrency(sales.reduce((acc, s) => acc + (s.status === 'completada' ? s.total : 0), 0))}
            </h3>
          </div>
        </Card>

        <Card className="rounded-[32px] border-none shadow-sm bg-white p-8 group hover:shadow-xl transition-all duration-500">
          <div className="flex justify-between items-start mb-6">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <ShoppingCart className="h-7 w-7" />
            </div>
            <Badge className="bg-blue-50 text-blue-600 border-none font-black px-3 py-1 rounded-full uppercase text-[10px] tracking-widest italic">Volume</Badge>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Operaciones Totales</p>
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter italic">
              {sales.filter(s => s.status === 'completada').length} <span className="text-lg text-slate-300">items</span>
            </h3>
          </div>
        </Card>

        <Card className="rounded-[32px] border-none shadow-sm bg-white p-8 group hover:shadow-xl transition-all duration-500">
          <div className="flex justify-between items-start mb-6">
            <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
              <CreditCard className="h-7 w-7" />
            </div>
            <Badge className="bg-orange-50 text-orange-600 border-none font-black px-3 py-1 rounded-full uppercase text-[10px] tracking-widest italic">Creditos</Badge>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Ventas a Credito</p>
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter italic">
              {sales.filter(s => s.sale_type === 'credito').length} <span className="text-lg text-slate-300">pend.</span>
            </h3>
          </div>
        </Card>

        <Card className="rounded-[32px] border-none shadow-sm bg-white p-8 group hover:shadow-xl transition-all duration-500">
          <div className="flex justify-between items-start mb-6">
            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform">
              <X className="h-7 w-7" />
            </div>
            <Badge className="bg-rose-50 text-rose-600 border-none font-black px-3 py-1 rounded-full uppercase text-[10px] tracking-widest italic">Cancelaciones</Badge>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Ventas Canceladas</p>
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter italic">
              {sales.filter(s => s.status === 'cancelada').length} <span className="text-lg text-slate-300">bajas</span>
            </h3>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="sales" className="space-y-8">
        <TabsList className="bg-white p-2 rounded-[32px] h-20 border border-slate-100 shadow-sm inline-flex">
          <TabsTrigger value="sales" className="rounded-2xl px-10 data-[state=active]:bg-slate-900 data-[state=active]:text-white font-black uppercase tracking-widest text-xs h-full transition-all">
            Historial de Ventas
          </TabsTrigger>
          <TabsTrigger value="new" className="rounded-2xl px-10 data-[state=active]:bg-emerald-500 data-[state=active]:text-white font-black uppercase tracking-widest text-xs h-full transition-all">
            Nueva Transaccion
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-8 animate-in slide-in-from-left-4 duration-500">
          {/* Header Búsqueda con Estilo Masivo */}
          <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
            <div className="relative w-full md:w-[400px] group">
              <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                <Search className="h-6 w-6 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
              </div>
              <Input
                placeholder="BUSCAR VENTA POR FOLIO O CLIENTE..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-16 pl-16 rounded-[24px] border-none bg-white shadow-sm font-black text-sm uppercase tracking-widest placeholder:text-slate-300 focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Tabla de Ventas Big UI */}
          <div className="bg-white rounded-[44px] shadow-sm overflow-hidden p-4 border border-slate-50">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-50 hover:bg-transparent">
                    <TableHead className="h-20 px-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">IDENTIFICADOR</TableHead>
                    <TableHead className="h-20 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] hidden md:table-cell">DETALLE TEMPORAL</TableHead>
                    <TableHead className="h-20 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">TITULAR / CLIENTE</TableHead>
                    <TableHead className="h-20 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">VALOR TOTAL</TableHead>
                    <TableHead className="h-20 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] hidden sm:table-cell">SISTEMA PAGO</TableHead>
                    <TableHead className="h-20 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">STATUS</TableHead>
                    <TableHead className="h-20 px-8 text-right text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">ACCIONES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-20">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                          <p className="text-xl font-black text-slate-400 tracking-tighter uppercase">Sincronizando Ventas...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-20">
                        <p className="text-2xl font-black text-slate-300 tracking-tighter uppercase italic">Sin registros en este periodo.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSales.map((sale) => (
                      <TableRow key={sale.id} className="group border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <TableCell className="px-8 py-8">
                          <div className="flex flex-col gap-1">
                            <span className="text-2xl font-black text-slate-900 tracking-tighter italic">#{sale.sale_number}</span>
                            {sale.sale_type === "credito" && (
                              <Badge className="bg-orange-50 text-orange-600 border-none font-black px-3 py-1 rounded-lg uppercase text-[9px] tracking-[0.2em] w-fit italic">
                                CREDITO ACTIVO
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-8 hidden md:table-cell font-bold text-slate-400 uppercase text-xs tracking-widest italic">
                          {formatDate(sale.created_at)}
                        </TableCell>
                        <TableCell className="py-8">
                          <div className="flex flex-col gap-1">
                            <span className="text-lg font-black text-slate-900 uppercase tracking-tight">{sale.customer_name || "CLIENTE GENERAL"}</span>
                            {sale.customer?.discount_percentage && sale.customer.discount_percentage > 0 && (
                              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest italic">BENEFICIO {sale.customer.discount_percentage}% OFF</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-8">
                          <div className="flex flex-col gap-1">
                            <span className="text-3xl font-black text-slate-900 tracking-tighter italic">{formatCurrency(sale.total)}</span>
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{sale.items.length} ITEMS REGISTRADOS</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-8 hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                             <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{getPaymentMethodText(sale.payment_method)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-8">
                          <Badge className={cn(
                            "font-black px-4 py-2 rounded-xl uppercase text-[10px] tracking-widest italic border-none shadow-sm",
                            sale.status === "completada" 
                              ? "bg-emerald-50 text-emerald-600" 
                              : "bg-rose-50 text-rose-600"
                          )}>
                            {sale.status === "completada" ? "Venta Liquidada" : "Venta Cancelada"}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-8 py-8 text-right">
                          <div className="flex justify-end gap-3">
                            <Button 
                              variant="ghost" 
                              onClick={() => handleViewSale(sale)}
                              className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 hover:bg-slate-900 hover:text-white transition-all p-0"
                            >
                              <Printer className="h-5 w-5" />
                            </Button>
                            {sale.status === "completada" && (
                              <Button
                                variant="ghost"
                                onClick={() => handleCancelSale(sale)}
                                className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 border border-rose-100 hover:bg-rose-500 hover:text-white transition-all p-0"
                              >
                                <X className="h-5 w-5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="new" className="animate-in slide-in-from-right-4 duration-500">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 items-start">
            {/* Main Form Area */}
            <div className="xl:col-span-2 space-y-10">
              <Card className="rounded-[44px] border-none shadow-sm bg-white p-10">
                <div className="mb-10">
                  <h3 className="text-4xl font-black text-slate-900 tracking-tighter italic">Nueva Operacion.</h3>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Configuracion de Venta en Tiempo Real</p>
                </div>

                <div className="space-y-10">
                  {/* Selección de cliente con Estilo Big UI */}
                  <div className="space-y-4">
                    <Label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Titular de la Cuenta</Label>
                    <CustomerSelector onCustomerSelect={setSelectedCustomer} selectedCustomer={selectedCustomer} />
                  </div>

                  {/* Tipo de venta - Botones Gigantes */}
                  {selectedCustomer && (
                    <div className="space-y-4">
                      <Label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Modalidad de Transaccion</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setSaleType("contado")}
                          className={cn(
                            "h-24 rounded-3xl flex flex-col items-center justify-center gap-2 font-black transition-all border-2 uppercase text-xs tracking-widest italic",
                            saleType === "contado" 
                              ? "bg-slate-900 border-slate-900 text-white shadow-xl scale-[1.02]" 
                              : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                          )}
                        >
                          <DollarSign className={cn("h-6 w-6 mb-1", saleType === "contado" ? "text-emerald-400" : "text-slate-300")} />
                          Venta de Contado
                        </button>
                        <button
                          type="button"
                          onClick={() => setSaleType("credito")}
                          className={cn(
                            "h-24 rounded-3xl flex flex-col items-center justify-center gap-2 font-black transition-all border-2 uppercase text-xs tracking-widest italic",
                            saleType === "credito" 
                              ? "bg-orange-500 border-orange-500 text-white shadow-xl scale-[1.02]" 
                              : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                          )}
                        >
                          <CreditCard className={cn("h-6 w-6 mb-1", saleType === "credito" ? "text-orange-200" : "text-slate-300")} />
                          Linea de Credito
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Configuración de crédito Big UI */}
                  {saleType === "credito" && selectedCustomer && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-10 rounded-[32px] bg-orange-50 border border-orange-100">
                      <div className="space-y-4">
                        <Label className="text-[11px] font-black uppercase tracking-widest text-orange-600/60">Limite de Vencimiento</Label>
                        <div className="relative">
                          <Calendar className="absolute left-6 top-1/2 transform -translate-y-1/2 text-orange-300 h-6 w-6" />
                          <Input
                            type="date"
                            value={creditDueDate}
                            onChange={(e) => setCreditDueDate(e.target.value)}
                            className="h-16 pl-16 rounded-2xl border-none bg-white font-black text-orange-600 focus-visible:ring-2 focus-visible:ring-orange-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <Label className="text-[11px] font-black uppercase tracking-widest text-orange-600/60">Notas de Auditoria</Label>
                        <Textarea
                          value={creditNotes}
                          onChange={(e) => setCreditNotes(e.target.value)}
                          placeholder="Observaciones de riesgo o crediticias..."
                          className="rounded-2xl border-none bg-white font-bold p-6 min-h-[100px] focus-visible:ring-2 focus-visible:ring-orange-500 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Selección de productos Big UI */}
                  <div className="space-y-6 pt-4 border-t border-slate-50">
                    <Label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Escaneo y Selección de Items</Label>
                    <ProductSelector
                      onProductSelect={handleAddProduct}
                      excludeProductIds={newSaleItems.map((item) => item.product_id)}
                    />

                    {newSaleItems.length > 0 ? (
                      <div className="bg-slate-50/50 rounded-[40px] border border-slate-100 overflow-hidden p-2">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-none hover:bg-transparent">
                                <TableHead className="h-16 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">PRODUCTO</TableHead>
                                <TableHead className="h-16 w-40 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">QUANTITY</TableHead>
                                <TableHead className="h-16 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:table-cell">P. UNITARIO</TableHead>
                                <TableHead className="h-16 text-[10px] font-black text-slate-400 uppercase tracking-widest">SUBTOTAL</TableHead>
                                <TableHead className="h-16 w-16 p-0"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {newSaleItems.map((item, index) => (
                                <TableRow key={index} className="border-slate-100/50 hover:bg-white transition-colors">
                                  <TableCell className="px-6 py-6">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{item.product_name}</span>
                                      <div className="flex items-center gap-3">
                                        <Badge className={cn(
                                          "border-none font-black px-3 py-1 rounded-lg uppercase text-[9px] tracking-widest italic",
                                          item.price_type === 'wholesale' ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                                        )}>
                                          {item.price_type === "wholesale" ? "PRECIO MAYOREO" : "PRECIO PUBLICO"}
                                        </Badge>
                                        <button 
                                          onClick={() => handleToggleItemPriceType(index)}
                                          className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors underline underline-offset-4"
                                        >
                                          Cambiar Tarifa
                                        </button>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-6">
                                    <div className="flex items-center justify-center bg-white rounded-2xl p-1 border border-slate-100 shadow-sm w-fit mx-auto">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateItemQuantity(index, item.quantity - 1)}
                                        disabled={item.quantity <= 1}
                                        className="h-10 w-10 flex items-center justify-center text-xl font-black text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-colors"
                                      >
                                        -
                                      </button>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => handleUpdateItemQuantity(index, Number.parseInt(e.target.value) || 1)}
                                        className="h-10 w-12 border-none bg-transparent text-center font-black text-lg p-0 focus-visible:ring-0"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateItemQuantity(index, item.quantity + 1)}
                                        className="h-10 w-10 flex items-center justify-center text-xl font-black text-slate-400 hover:text-slate-900 transition-colors"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-6 hidden sm:table-cell font-bold text-slate-400 italic">
                                    {formatCurrency(item.unit_price)}
                                  </TableCell>
                                  <TableCell className="py-6 text-xl font-black text-slate-900 italic tracking-tighter">
                                    {formatCurrency(item.total)}
                                  </TableCell>
                                  <TableCell className="p-0 px-4">
                                    <button
                                      onClick={() => handleRemoveItem(index)}
                                      className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all mx-auto"
                                    >
                                      <X className="h-5 w-5" />
                                    </button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : (
                      <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[44px]">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200 mx-auto mb-4">
                          <Plus className="h-8 w-8" />
                        </div>
                        <p className="text-xl font-black text-slate-300 tracking-tighter uppercase italic">Esperando seleccion de productos...</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* Sticky Sidebar Cart/Payment */}
            <div className="space-y-8 xl:sticky xl:top-6 animate-in slide-in-from-right-10 duration-700">
               <Card className="rounded-3xl border-none shadow-xl bg-white p-6 md:p-8 overflow-hidden relative">
                 <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-[80px]" />
                 
                 <h3 className="text-2xl font-black text-slate-900 tracking-tighter italic mb-6 flex items-center gap-3">
                   Resumen <span className="text-emerald-500">Caja.</span>
                 </h3>

                <div className="space-y-6 mb-10">
                  <div className="flex justify-between items-center text-sm font-black text-slate-400 uppercase tracking-widest">
                    <span>Bruto Total</span>
                    <span>{formatCurrency(calculateSubtotal())}</span>
                  </div>
                  {selectedCustomer && selectedCustomer.discount_percentage > 0 && (
                    <div className="flex justify-between items-center text-sm font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-4 py-2 rounded-xl">
                      <span>Descuento Especial</span>
                      <span>-{formatCurrency(calculateDiscount())}</span>
                    </div>
                  )}
                  {settings.tax_enabled && (
                    <div className="flex justify-between items-center text-sm font-black text-slate-400 uppercase tracking-widest">
                      <span>IVA Fiscal ({settings.tax_rate}%)</span>
                      <span>{formatCurrency(calculateSaleTax())}</span>
                    </div>
                  )}
                  <div className="pt-5 border-t border-slate-100">
                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Monto Neto a Liquidar</p>
                    <div className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter italic">
                      {formatCurrency(calculateTotal())}
                    </div>
                  </div>
                </div>

                {/* Info de Pago Big UI Sidebar */}
                {saleType === "contado" && newSaleItems.length > 0 && (
                  <div className="space-y-8 animate-in fade-in duration-500">
                    <div className="space-y-4">
                      <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Modalidad de Pago</Label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: 'efectivo', icon: DollarSign, label: 'Efectivo' },
                          { id: 'tarjeta', icon: CreditCard, label: 'Tarjeta' },
                          { id: 'transferencia', icon: ShoppingCart, label: 'Transf.' }
                        ].map((method) => (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => {
                              setPaymentMethod(method.id)
                              if (method.id !== 'efectivo') {
                                setShowChangeCalculator(false)
                                setAmountPaid(calculateTotal().toString())
                              } else {
                                setShowChangeCalculator(true)
                              }
                            }}
                            className={cn(
                              "flex-1 h-14 rounded-2xl border-2 font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm",
                              paymentMethod === method.id 
                                ? "bg-slate-900 border-slate-900 text-white" 
                                : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                            )}
                          >
                            <method.icon className={cn("h-4 w-4", paymentMethod === method.id ? "text-emerald-400" : "text-slate-300")} />
                            {method.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 space-y-4">
                      <div className="space-y-2 text-center">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {paymentMethod === "efectivo" ? "Monto Recibido" : "Confirmacion Monto"}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={amountPaid}
                          onChange={(e) => setAmountPaid(e.target.value)}
                          className="h-14 text-3xl font-black text-center border-none bg-white rounded-xl shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-500 text-slate-900"
                        />
                      </div>

                      {paymentMethod === "efectivo" && amountPaid && (
                        <div className={cn(
                          "p-4 rounded-xl border-2 text-center transition-all animate-bounce-subtle",
                          calculateChange() >= 0 ? "bg-emerald-50 border-emerald-500/20" : "bg-rose-50 border-rose-500/20 shadow-none animate-none"
                        )}>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Cambio a Entregar</p>
                          <p className={cn(
                            "text-3xl font-black italic tracking-tighter",
                            calculateChange() >= 0 ? "text-emerald-600" : "text-rose-600"
                          )}>
                            {formatCurrency(calculateChange())}
                          </p>
                          {calculateChange() < 0 && <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest mt-1 block">⚠️ Fondo Insuficiente</span>}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-10 space-y-4">
                   <Button
                     onClick={handleCreateSale}
                     disabled={newSaleItems.length === 0}
                     className="w-full h-16 md:h-20 rounded-3xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all group"
                   >
                     <div className="flex flex-col items-center">
                       <span className="text-[9px] font-black uppercase tracking-[0.2em] mb-1 group-hover:tracking-[0.3em] transition-all">Consolidar Operacion</span>
                       <div className="flex items-center gap-2">
                         <ShoppingCart className="h-5 w-5" />
                         <span className="text-lg font-black italic tracking-tight">
                           {saleType === "credito" ? "Autorizar Credito" : "Completar Venta"}
                         </span>
                       </div>
                     </div>
                   </Button>
                  <Button 
                    variant="ghost" 
                    onClick={resetForm} 
                    className="w-full h-14 rounded-2xl font-black uppercase text-xs tracking-widest text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                  >
                    Abortar Operacion
                  </Button>
                </div>
              </Card>

              {/* Tips de Seguridad/Venta */}
              <div className="p-8 rounded-[32px] bg-slate-900 text-white flex items-center gap-6 shadow-xl">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400">
                  <ShoppingCart className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest mb-1 italic">Venta Segura.</h4>
                  <p className="text-[10px] font-medium text-slate-400 leading-tight">Verifique siempre el cambio físico antes de finalizar la operación en el sistema.</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Diálogo para ver/imprimir venta - BIG UI Redesign */}
      <Dialog open={isViewSaleDialogOpen} onOpenChange={setIsViewSaleDialogOpen}>
         <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
           <div className="bg-[#f8fafc] p-6 md:p-8 space-y-8">
             <DialogHeader>
               <div className="flex justify-between items-center mb-4">
                 <DialogTitle className="text-3xl font-black text-slate-900 tracking-tighter">
                   Comprobante <span className="text-emerald-500 italic">#{selectedSale?.sale_number}</span>
                 </DialogTitle>
                <Badge className={cn(
                  "font-black px-4 py-2 rounded-xl uppercase text-[10px] tracking-widest italic border-none shadow-sm",
                  selectedSale?.status === "completada" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                )}>
                  {selectedSale?.status === "completada" ? "Liquidada" : "Cancelada"}
                </Badge>
              </div>
            </DialogHeader>

            {selectedSale && (
              <div className="space-y-10 animate-in fade-in zoom-in-95 duration-500">
                <div className="bg-white rounded-[32px] shadow-sm p-1 border border-slate-100 overflow-hidden">
                  <div className="p-10 bg-[#fff] m-2 rounded-[28px] border border-slate-50 shadow-inner">
                    {renderSaleTicket(selectedSale)}
                  </div>
                </div>
                
                <div className="flex flex-col md:flex-row justify-between items-center gap-6 p-8 bg-white rounded-[32px] border border-slate-100">
                  <div className="flex gap-4 w-full md:w-auto">
                    {selectedSale.status === "completada" && (
                      <Button 
                        onClick={() => handleCancelSale(selectedSale)} 
                        variant="ghost" 
                        className="h-16 px-8 rounded-2xl font-black uppercase text-xs tracking-widest text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all border border-rose-100"
                      >
                        <X className="h-5 w-5 mr-3" />
                        Cancelar Venta
                      </Button>
                    )}
                  </div>
                  <div className="w-full md:w-auto">
                    <PrintableDocument
                      title={`Venta #${selectedSale.sale_number}`}
                      content={renderSaleTicket(selectedSale)}
                      className="h-16 w-full md:w-auto px-12 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                      <Printer className="h-5 w-5 mr-1" />
                      Imprimir Comprobante
                    </PrintableDocument>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
