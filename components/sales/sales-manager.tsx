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
    <div className="space-y-4 p-2 md:p-6">
      {/* Botón de Corte de Caja */}
      <div className="flex justify-end mb-2">
      </div>
      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sales">Ventas</TabsTrigger>
          <TabsTrigger value="new">Nueva Venta</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          {/* Header con búsqueda */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar ventas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {/* Corte de caja */}
            <CashCut />

          </div>

          {/* Tabla de ventas */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Venta #</TableHead>
                      <TableHead className="hidden md:table-cell">Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead className="hidden sm:table-cell">Método</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4">
                          Cargando ventas...
                        </TableCell>
                      </TableRow>
                    ) : filteredSales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4">
                          No se encontraron ventas
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>
                            <div className="font-medium">{sale.sale_number}</div>
                            {sale.sale_type === "credito" && (
                              <Badge variant="outline" className="text-xs">
                                Crédito
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{formatDate(sale.created_at)}</TableCell>
                          <TableCell>
                            <div className="truncate max-w-32">{sale.customer_name || "Cliente General"}</div>
                            {sale.customer?.discount_percentage && sale.customer.discount_percentage > 0 && (
                              <Badge className="bg-green-100 text-green-800 mt-1 text-xs">
                                {sale.customer.discount_percentage}% desc.
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{formatCurrency(sale.total)}</div>
                            <div className="text-xs text-gray-500">
                              {sale.items.length} {sale.items.length === 1 ? "item" : "items"}
                            </div>
                            {sale.change_amount > 0 && (
                              <div className="text-xs text-blue-500">Cambio: {formatCurrency(sale.change_amount)}</div>
                            )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {getPaymentMethodText(sale.payment_method)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={sale.status === "completada" ? "default" : "secondary"}>
                              {sale.status === "completada" ? "Completada" : "Cancelada"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleViewSale(sale)}>
                                <Printer className="h-4 w-4" />
                              </Button>
                              {sale.status === "completada" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelSale(sale)}
                                  className="text-red-600"
                                  title="Cancelar venta"
                                >
                                  <X className="h-4 w-4" />
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="new" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Nueva Venta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Selección de cliente */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Cliente</h3>
                <CustomerSelector onCustomerSelect={setSelectedCustomer} selectedCustomer={selectedCustomer} />
              </div>

              {/* Tipo de venta */}
              {selectedCustomer && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Tipo de Venta</h3>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={saleType === "contado" ? "default" : "outline"}
                      onClick={() => setSaleType("contado")}
                      size="sm"
                    >
                      Contado
                    </Button>
                    <Button
                      type="button"
                      variant={saleType === "credito" ? "default" : "outline"}
                      onClick={() => setSaleType("credito")}
                      size="sm"
                    >
                      <CreditCard className="h-4 w-4 mr-1" />
                      Crédito
                    </Button>
                  </div>
                </div>
              )}

              {/* Configuración de crédito */}
              {saleType === "credito" && selectedCustomer && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md bg-blue-50">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Fecha de Vencimiento</h4>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        type="date"
                        value={creditDueDate}
                        onChange={(e) => setCreditDueDate(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Notas del Crédito</h4>
                    <Textarea
                      value={creditNotes}
                      onChange={(e) => setCreditNotes(e.target.value)}
                      placeholder="Notas adicionales..."
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {/* Selección de productos */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Productos</h3>
                <ProductSelector
                  onProductSelect={handleAddProduct}
                  excludeProductIds={newSaleItems.map((item) => item.product_id)}
                />

                {newSaleItems.length > 0 ? (
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
                          {newSaleItems.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <div>
                                  <div className="truncate max-w-32 font-medium">{item.product_name}</div>
                                  {item.variant_name && (
                                    <div className="text-xs text-gray-500">{item.variant_name}</div>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    <Switch
                                      checked={item.price_type === "wholesale"}
                                      onCheckedChange={() => handleToggleItemPriceType(index)}
                                      className="scale-75"
                                    />
                                    <Label className="text-xs">
                                      {item.price_type === "wholesale" ? "Puesto" : "Público"}
                                    </Label>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-6 w-6 bg-transparent"
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
                                    className="h-6 w-6 bg-transparent"
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
                    No hay productos agregados a la venta
                  </div>
                )}
              </div>

              {/* Enhanced Payment Section */}
              {saleType === "contado" && newSaleItems.length > 0 && (
                <div className="space-y-4 p-4 border rounded-md bg-gray-50">
                  <h3 className="text-lg font-medium flex items-center">
                    <DollarSign className="h-5 w-5 mr-2" />
                    Información de Pago
                  </h3>

                  {/* Total Amount Display */}
                  <div className="bg-white p-4 rounded-md border-2 border-blue-200">
                    <div className="text-center">
                      <div className="text-sm text-gray-600 mb-1">Total a Pagar</div>
                      <div className="text-3xl font-bold text-blue-600">{formatCurrency(calculateTotal())}</div>
                    </div>
                  </div>

                  {/* Payment Method Selection */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Método de Pago</h4>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={paymentMethod === "efectivo" ? "default" : "outline"}
                        onClick={() => {
                          setPaymentMethod("efectivo")
                          setShowChangeCalculator(true)
                        }}
                        size="sm"
                      >
                        Efectivo
                      </Button>
                      <Button
                        type="button"
                        variant={paymentMethod === "tarjeta" ? "default" : "outline"}
                        onClick={() => {
                          setPaymentMethod("tarjeta")
                          setShowChangeCalculator(false)
                          setAmountPaid(calculateTotal().toString())
                        }}
                        size="sm"
                      >
                        Tarjeta
                      </Button>
                      <Button
                        type="button"
                        variant={paymentMethod === "transferencia" ? "default" : "outline"}
                        onClick={() => {
                          setPaymentMethod("transferencia")
                          setShowChangeCalculator(false)
                          setAmountPaid(calculateTotal().toString())
                        }}
                        size="sm"
                      >
                        Transferencia
                      </Button>
                    </div>
                  </div>

                  {/* Payment Amount Input */}
                  <div className="space-y-2">
                    <Label htmlFor="payment_amount">
                      {paymentMethod === "efectivo" ? "Con cuánto paga" : "Monto pagado"}
                    </Label>
                    <Input
                      id="payment_amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="text-lg font-bold text-center"
                    />
                  </div>

                  {/* Change Calculation */}
                  {paymentMethod === "efectivo" && amountPaid && (
                    <div className="bg-white p-4 rounded-md border-2 border-green-200">
                      <div className="text-center">
                        <div className="text-sm text-gray-600 mb-1">Cambio</div>
                        <div
                          className={`text-2xl font-bold ${calculateChange() >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {formatCurrency(calculateChange())}
                        </div>
                        {calculateChange() < 0 && <div className="text-sm text-red-600 mt-1">⚠️ Monto insuficiente</div>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Resumen */}
              {newSaleItems.length > 0 && (
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
                      <span>{formatCurrency(calculateSaleTax())}</span>
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
                <Button variant="outline" onClick={resetForm} className="w-full sm:w-auto bg-transparent">
                  Limpiar
                </Button>
                <Button onClick={handleCreateSale} disabled={newSaleItems.length === 0} className="w-full sm:w-auto">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {saleType === "credito" ? "Crear Venta a Crédito" : "Completar Venta"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo para ver/imprimir venta */}
      <Dialog open={isViewSaleDialogOpen} onOpenChange={setIsViewSaleDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Venta #{selectedSale?.sale_number}</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="border rounded-md p-4">{renderSaleTicket(selectedSale)}</div>
              <div className="flex flex-col sm:flex-row justify-between gap-2">
                <div>
                  {selectedSale.status === "completada" && (
                    <Button onClick={() => handleCancelSale(selectedSale)} variant="destructive" size="sm">
                      <X className="h-4 w-4 mr-2" />
                      Cancelar Venta
                    </Button>
                  )}
                </div>
                <PrintableDocument
                  title={`Venta #${selectedSale.sale_number}`}
                  content={renderSaleTicket(selectedSale)}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
