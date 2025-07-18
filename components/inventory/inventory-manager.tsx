"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Package, TrendingUp, TrendingDown, RotateCcw, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import PDFInvoiceProcessor from "./pdf-invoice-processor"

interface Product {
  id: string
  name: string
  barcode: string
  stock_quantity: number
  min_stock: number
  category: string
  brand: string
}

interface InventoryMovement {
  id: string
  product_id: string
  movement_type: "entrada" | "salida" | "ajuste"
  quantity: number
  reason: string
  reference_id: string | null
  created_at: string
  products: Product
}

export default function InventoryManager() {
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [movementFilter, setMovementFilter] = useState("")
  const [selectedProduct, setSelectedProduct] = useState("")
  const [formData, setFormData] = useState({
    product_id: "",
    movement_type: "",
    quantity: "",
    reason: "",
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Obtener productos
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, barcode, stock_quantity, min_stock, category, brand")
        .order("name")

      if (productsError) throw productsError

      // Obtener movimientos de inventario con información del producto
      const { data: movementsData, error: movementsError } = await supabase
        .from("inventory_movements")
        .select(`
          *,
          products (
            id,
            name,
            barcode,
            stock_quantity,
            min_stock,
            category,
            brand
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100)

      if (movementsError) throw movementsError

      setProducts(productsData || [])
      setMovements(movementsData || [])
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const movementData = {
        product_id: formData.product_id,
        movement_type: formData.movement_type,
        quantity: Number.parseInt(formData.quantity),
        reason: formData.reason,
        user_id: user?.id,
      }

      const { error } = await supabase.from("inventory_movements").insert([movementData])

      if (error) throw error

      await fetchData()
      resetForm()
      setIsDialogOpen(false)
    } catch (error) {
      console.error("Error saving movement:", error)
      alert("Error al guardar el movimiento")
    }
  }

  const resetForm = () => {
    setFormData({
      product_id: "",
      movement_type: "",
      quantity: "",
      reason: "",
    })
  }

  const getMovementIcon = (type: string) => {
    switch (type) {
      case "entrada":
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case "salida":
        return <TrendingDown className="h-4 w-4 text-red-600" />
      case "ajuste":
        return <RotateCcw className="h-4 w-4 text-blue-600" />
      default:
        return <Package className="h-4 w-4" />
    }
  }

  const getMovementBadge = (type: string) => {
    switch (type) {
      case "entrada":
        return <Badge className="bg-green-100 text-green-800">Entrada</Badge>
      case "salida":
        return <Badge className="bg-red-100 text-red-800">Salida</Badge>
      case "ajuste":
        return <Badge className="bg-blue-100 text-blue-800">Ajuste</Badge>
      default:
        return <Badge variant="secondary">{type}</Badge>
    }
  }

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  const filteredMovements = movements.filter((movement) => {
    const matchesFilter = !movementFilter || movementFilter === "all" || movement.movement_type === movementFilter
    const matchesProduct = !selectedProduct || selectedProduct === "all" || movement.product_id === selectedProduct
    return matchesFilter && matchesProduct
  })

  const lowStockProducts = products.filter((product) => product.stock_quantity <= product.min_stock)
  const outOfStockProducts = products.filter((product) => product.stock_quantity === 0)

  const clearFilters = () => {
    setMovementFilter("all")
    setSelectedProduct("all")
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">Cargando inventario...</div>
  }

  return (
    <div className="space-y-6">
      {/* Resumen de inventario */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{lowStockProducts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sin Stock</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{outOfStockProducts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Movimientos Hoy</CardTitle>
            <RotateCcw className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {movements.filter((m) => new Date(m.created_at).toDateString() === new Date().toDateString()).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="movements" className="space-y-4">
        <TabsList>
          <TabsTrigger value="movements">Movimientos</TabsTrigger>
          <TabsTrigger value="stock">Estado de Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="movements" className="space-y-4">
          {/* Header con filtros y botón agregar movimiento */}
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="flex flex-col sm:flex-row gap-2">
                <Select
                  value={movementFilter || "all"}
                  onValueChange={(value) => setMovementFilter(value === "all" ? "" : value)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Tipo de movimiento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los movimientos</SelectItem>
                    <SelectItem value="entrada">Entradas</SelectItem>
                    <SelectItem value="salida">Salidas</SelectItem>
                    <SelectItem value="ajuste">Ajustes</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={selectedProduct || "all"}
                  onValueChange={(value) => setSelectedProduct(value === "all" ? "" : value)}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Filtrar por producto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los productos</SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(movementFilter || selectedProduct) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setMovementFilter("")
                      setSelectedProduct("")
                    }}
                  >
                    Limpiar Filtros
                  </Button>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {/* Nuevo botón para procesar facturas PDF */}
              <PDFInvoiceProcessor />

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Movimiento
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Registrar Movimiento de Inventario</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="product">Producto *</Label>
                      <Select
                        value={formData.product_id}
                        onValueChange={(value) => setFormData({ ...formData, product_id: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar producto" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} (Stock: {product.stock_quantity})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="movement_type">Tipo de Movimiento *</Label>
                      <Select
                        value={formData.movement_type}
                        onValueChange={(value) => setFormData({ ...formData, movement_type: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="entrada">Entrada (Agregar stock)</SelectItem>
                          <SelectItem value="salida">Salida (Reducir stock)</SelectItem>
                          <SelectItem value="ajuste">Ajuste (Corregir stock)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="quantity">
                        {formData.movement_type === "ajuste" ? "Nueva Cantidad *" : "Cantidad *"}
                      </Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="0"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        required
                      />
                      {formData.movement_type === "ajuste" && (
                        <p className="text-sm text-gray-500">Ingresa la cantidad total que debe tener el producto</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reason">Motivo *</Label>
                      <Textarea
                        id="reason"
                        value={formData.reason}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        placeholder="Ej: Compra de mercancía, Venta, Producto dañado, etc."
                        required
                      />
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit">Registrar Movimiento</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Tabla de movimientos */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead className="hidden md:table-cell">Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMovements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(movement.created_at).toLocaleDateString()}
                            <div className="text-xs text-gray-500">
                              {new Date(movement.created_at).toLocaleTimeString()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{movement.products.name}</div>
                            <div className="text-sm text-gray-500">
                              Stock actual: {movement.products.stock_quantity}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getMovementIcon(movement.movement_type)}
                            {getMovementBadge(movement.movement_type)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`font-medium ${
                              movement.movement_type === "entrada"
                                ? "text-green-600"
                                : movement.movement_type === "salida"
                                  ? "text-red-600"
                                  : "text-blue-600"
                            }`}
                          >
                            {movement.movement_type === "entrada"
                              ? "+"
                              : movement.movement_type === "salida"
                                ? "-"
                                : ""}
                            {movement.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="max-w-xs truncate" title={movement.reason}>
                            {movement.reason}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock" className="space-y-4">
          {/* Búsqueda de productos */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Alertas de stock */}
          {outOfStockProducts.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-800">Productos Sin Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {outOfStockProducts.map((product) => (
                    <div key={product.id} className="flex justify-between items-center">
                      <span className="text-sm">{product.name}</span>
                      <Badge variant="destructive">Sin Stock</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {lowStockProducts.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="text-orange-800">Productos con Stock Bajo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {lowStockProducts
                    .filter((p) => p.stock_quantity > 0)
                    .map((product) => (
                      <div key={product.id} className="flex justify-between items-center">
                        <span className="text-sm">{product.name}</span>
                        <Badge className="bg-orange-100 text-orange-800">Stock: {product.stock_quantity}</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabla de estado de stock */}
          <Card>
            <CardHeader>
              <CardTitle>Estado General del Inventario</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="hidden sm:table-cell">Marca</TableHead>
                      <TableHead className="hidden md:table-cell">Categoría</TableHead>
                      <TableHead>Stock Actual</TableHead>
                      <TableHead>Stock Mínimo</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{product.name}</div>
                            {product.barcode && <div className="text-sm text-gray-500">{product.barcode}</div>}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{product.brand}</TableCell>
                        <TableCell className="hidden md:table-cell">{product.category}</TableCell>
                        <TableCell>
                          <span className="font-medium">{product.stock_quantity}</span>
                        </TableCell>
                        <TableCell>{product.min_stock}</TableCell>
                        <TableCell>
                          {product.stock_quantity === 0 ? (
                            <Badge variant="destructive">Sin Stock</Badge>
                          ) : product.stock_quantity <= product.min_stock ? (
                            <Badge className="bg-orange-100 text-orange-800">Stock Bajo</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800">Normal</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
