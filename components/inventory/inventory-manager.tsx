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
import { cn } from "@/lib/utils"

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
    <div className="space-y-10 p-6 lg:p-12 bg-[#f8fafc] min-h-full transition-all duration-500 animate-in fade-in slide-in-from-bottom-4">
      {/* Título de la página */}
      <div className="mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h1 className="text-7xl font-black text-slate-900 tracking-tighter leading-none mb-4">
            Inventario<span className="text-[#10b981]">.</span>
          </h1>
          <p className="text-xl font-bold text-slate-400 max-w-2xl">
            Control total de flujos, auditoría de movimientos y monitoreo de existencias críticas en tiempo real.
          </p>
        </div>
        <div className="hidden lg:flex gap-4">
          <div className="p-6 bg-white rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Productos Activos</p>
              <p className="text-2xl font-black text-slate-900 leading-none">{products.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Resumen de inventario (High-Impact Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm rounded-[32px] bg-white overflow-hidden group hover:shadow-md transition-all">
          <CardContent className="p-8">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <Package className="h-6 w-6" />
              </div>
              <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[10px]">TOTAL</Badge>
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Items en Stock</p>
            <div className="text-5xl font-black text-slate-900 tracking-tighter">{products.length}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[32px] bg-white overflow-hidden group hover:shadow-md transition-all">
          <CardContent className="p-8">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-orange-50 rounded-2xl text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                <TrendingDown className="h-6 w-6" />
              </div>
              <Badge className="bg-orange-50 text-orange-600 border-none font-black text-[10px]">CRÍTICO</Badge>
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Stock Bajo</p>
            <div className="text-5xl font-black text-orange-600 tracking-tighter">{lowStockProducts.length}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[32px] bg-white overflow-hidden group hover:shadow-md transition-all">
          <CardContent className="p-8">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-rose-50 rounded-2xl text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                <TrendingDown className="h-6 w-6" />
              </div>
              <Badge className="bg-rose-50 text-rose-600 border-none font-black text-[10px]">AGOTADO</Badge>
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Sin Stock</p>
            <div className="text-5xl font-black text-rose-600 tracking-tighter">{outOfStockProducts.length}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[32px] bg-white overflow-hidden group hover:shadow-md transition-all">
          <CardContent className="p-8">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 rounded-2xl text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                <RotateCcw className="h-6 w-6" />
              </div>
              <Badge className="bg-blue-50 text-blue-600 border-none font-black text-[10px]">HOY</Badge>
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Movimientos</p>
            <div className="text-5xl font-black text-blue-600 tracking-tighter">
              {movements.filter((m) => new Date(m.created_at).toDateString() === new Date().toDateString()).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="movements" className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <TabsList className="bg-slate-100 p-1.5 rounded-3xl h-16 w-full md:w-auto">
            <TabsTrigger value="movements" className="px-8 rounded-2xl font-black text-xs uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
              Auditoría de Movimientos
            </TabsTrigger>
            <TabsTrigger value="stock" className="px-8 rounded-2xl font-black text-xs uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
              Monitor de Existencias
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-4 w-full md:w-auto">
            <PDFInvoiceProcessor />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} className="h-16 flex-1 md:flex-none rounded-3xl bg-slate-900 hover:bg-black text-white font-black px-10 text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95">
                  <Plus className="h-5 w-5 mr-3" />
                  Registrar Movimiento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl rounded-[40px] border-none shadow-2xl p-10">
                <DialogHeader className="mb-8">
                  <DialogTitle className="text-4xl font-black text-slate-900 tracking-tighter">
                    Nuevo <span className="text-emerald-500">Registro.</span>
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-3">
                    <Label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Seleccionar Producto *</Label>
                    <Select value={formData.product_id} onValueChange={(v) => setFormData({ ...formData, product_id: v })} required>
                      <SelectTrigger className="h-14 bg-slate-50 border-none rounded-2xl font-bold px-6">
                        <SelectValue placeholder="Buscar producto por nombre..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl p-2 max-h-[300px]">
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="rounded-xl p-3">
                            {p.name} <span className="ml-2 py-0.5 px-2 bg-slate-100 rounded text-[10px] text-slate-500 opacity-60">Stock: {p.stock_quantity}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Tipo de Tránsito *</Label>
                      <Select value={formData.movement_type} onValueChange={(v) => setFormData({ ...formData, movement_type: v })} required>
                        <SelectTrigger className="h-14 bg-slate-50 border-none rounded-2xl font-bold px-6">
                          <SelectValue placeholder="Concepto..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                          <SelectItem value="entrada" className="text-emerald-600 font-bold">↑ ENTRADA (Suma)</SelectItem>
                          <SelectItem value="salida" className="text-rose-600 font-bold">↓ SALIDA (Resta)</SelectItem>
                          <SelectItem value="ajuste" className="text-blue-600 font-bold">↔ AJUSTE (Absoluto)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Cantidad *</Label>
                      <Input type="number" min="0" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} className="h-14 bg-slate-50 border-none rounded-2xl text-xl font-black" required />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Justificación Operativa *</Label>
                    <Textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} placeholder="Ingresa el motivo detallado del movimiento..." className="bg-slate-50 border-none rounded-3xl p-6 text-base font-medium resize-none min-h-[120px]" required />
                  </div>

                  <div className="flex justify-end gap-3 pt-6">
                    <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-2xl font-black uppercase text-xs tracking-widest text-slate-400">Cancelar</Button>
                    <Button type="submit" className="h-14 px-8 rounded-2xl bg-[#10b981] text-white font-black uppercase text-xs tracking-widest shadow-lg shadow-emerald-100">Guardar Registro</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <TabsContent value="movements" className="space-y-8 py-4 outline-none">
          <div className="flex flex-col lg:flex-row gap-6 items-center bg-white p-8 rounded-[40px] shadow-sm border border-slate-50">
            <div className="flex-1 w-full flex flex-col sm:flex-row gap-4">
              <Select value={movementFilter || "all"} onValueChange={(v) => setMovementFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="h-14 bg-slate-50 border-none rounded-2xl font-bold px-6 flex-1">
                  <SelectValue placeholder="Tipo de Movimiento" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-xl">
                  <SelectItem value="all">Todos los tránsitos</SelectItem>
                  <SelectItem value="entrada">Entradas Maestras</SelectItem>
                  <SelectItem value="salida">Salidas Maestras</SelectItem>
                  <SelectItem value="ajuste">Ajustes Especiales</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedProduct || "all"} onValueChange={(v) => setSelectedProduct(v === "all" ? "" : v)}>
                <SelectTrigger className="h-14 bg-slate-50 border-none rounded-2xl font-bold px-6 flex-1">
                  <SelectValue placeholder="Filtrar por Producto..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-xl max-h-[400px]">
                  <SelectItem value="all">Todos los productos</SelectItem>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>

              {(movementFilter || selectedProduct) && (
                <Button variant="ghost" onClick={clearFilters} className="h-14 px-6 font-black text-xs uppercase tracking-widest text-slate-400 hover:text-rose-500">
                  Limpiar
                </Button>
              )}
            </div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Mostrando {filteredMovements.length} Registros
            </div>
          </div>

          <Card className="border-none shadow-sm rounded-[44px] overflow-hidden bg-white p-4">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-50 hover:bg-transparent">
                    <TableHead className="h-16 px-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Ejecutado</TableHead>
                    <TableHead className="h-16 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Producto / Ítem</TableHead>
                    <TableHead className="h-16 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Flujo</TableHead>
                    <TableHead className="h-16 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Efecto</TableHead>
                    <TableHead className="h-16 hidden md:table-cell px-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Justificación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.map((movement) => (
                    <TableRow key={movement.id} className="group border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <TableCell className="px-8 py-8">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 text-sm italic">{new Date(movement.created_at).toLocaleDateString()}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(movement.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-8">
                        <div>
                          <div className="text-xl font-black text-slate-900 group-hover:text-emerald-500 transition-colors tracking-tight">{movement.products.name}</div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock: {movement.products.stock_quantity} unidades</div>
                        </div>
                      </TableCell>
                      <TableCell className="py-8">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            movement.movement_type === "entrada" ? "bg-emerald-50 text-emerald-600" :
                            movement.movement_type === "salida" ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"
                          )}>
                            {getMovementIcon(movement.movement_type)}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">
                            {movement.movement_type === "entrada" ? "Ingreso" : movement.movement_type === "salida" ? "Despacho" : "Ajuste"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-8">
                        <span className={cn(
                          "text-2xl font-black italic tracking-tighter",
                          movement.movement_type === "entrada" ? "text-emerald-500" :
                          movement.movement_type === "salida" ? "text-rose-500" : "text-blue-500"
                        )}>
                          {movement.movement_type === "entrada" ? "+" : movement.movement_type === "salida" ? "-" : "≈"}
                          {movement.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-8 px-8">
                        <div className="text-xs font-bold text-slate-400 max-w-[200px] truncate group-hover:whitespace-normal group-hover:overflow-visible transition-all uppercase leading-relaxed tracking-tight" title={movement.reason}>
                          {movement.reason}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock" className="space-y-8 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 h-6 w-6" />
                <Input
                  placeholder="Escribre el nombre del ítem para auditar stock..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-16 h-16 bg-white border-none rounded-[32px] text-lg font-bold shadow-sm placeholder:text-slate-300"
                />
              </div>

              {outOfStockProducts.length > 0 && (
                <Card className="border-none bg-rose-50 rounded-[40px] p-8 shadow-sm animate-in fade-in slide-in-from-left-4">
                  <div className="flex items-start gap-6">
                    <div className="p-4 bg-white rounded-2xl shadow-sm text-rose-500">
                      <TrendingDown className="h-8 w-8" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-black text-rose-900 uppercase tracking-tight mb-2">Quiebre de Stock</h4>
                      <p className="text-rose-700 font-bold mb-4 opacity-80">
                        {outOfStockProducts.length} productos no tienen existencias disponibles para venta.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {outOfStockProducts.slice(0, 5).map((p) => (
                          <Badge key={p.id} className="bg-white/50 border-rose-200 text-rose-700 font-black px-4 py-1.5 rounded-xl uppercase text-[10px]">
                            {p.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {lowStockProducts.length > 0 && outOfStockProducts.length === 0 && (
                <Card className="border-none bg-orange-50 rounded-[40px] p-8 shadow-sm animate-in fade-in slide-in-from-left-4">
                  <div className="flex items-start gap-6">
                    <div className="p-4 bg-white rounded-2xl shadow-sm text-orange-500">
                      <TrendingDown className="h-8 w-8" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-black text-orange-900 uppercase tracking-tight mb-2">Exposición Crítica</h4>
                      <p className="text-orange-700 font-bold mb-4 opacity-80">
                        {lowStockProducts.length} productos operan bajo el stock mínimo de seguridad.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {lowStockProducts.slice(0, 5).map((p) => (
                          <Badge key={p.id} className="bg-white/50 border-orange-200 text-orange-700 font-black px-4 py-1.5 rounded-xl uppercase text-[10px]">
                            {p.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>

            <Card className="border-none shadow-sm rounded-[40px] bg-white p-8">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-6 flex items-center gap-3">
                <div className="w-2 h-8 bg-emerald-500 rounded-full" />
                Composicion de Inventario
              </h3>
              <div className="space-y-6">
                {[...new Set(products.map(p => p.category))].slice(0, 6).map((cat, idx) => {
                  const items = products.filter(p => p.category === cat);
                  const lowItems = items.filter(p => p.stock_quantity <= p.min_stock);
                  return (
                    <div key={cat || 'Otros'} className="flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all text-sm">{idx + 1}</div>
                         <div>
                           <p className="font-black text-slate-900 uppercase text-xs tracking-widest">{cat || 'SIN CATEGORÍA'}</p>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{items.length} Tipos de productos</p>
                         </div>
                      </div>
                      <Badge className={cn(
                        "rounded-xl font-black px-4 h-8",
                        lowItems.length > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                      )}>
                        {lowItems.length > 0 ? `RIESGO: ${lowItems.length}` : 'SEGURO'}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>

          <Card className="border-none shadow-sm rounded-[44px] overflow-hidden bg-white p-4">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-50 hover:bg-transparent">
                    <TableHead className="h-16 px-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Producto / Ítem</TableHead>
                    <TableHead className="h-16 hidden sm:table-cell text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Marca / Categoría</TableHead>
                    <TableHead className="h-16 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Existencia</TableHead>
                    <TableHead className="h-16 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">S. Mínimo</TableHead>
                    <TableHead className="h-16 text-right px-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Estatus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id} className="group border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <TableCell className="px-8 py-8">
                        <div>
                          <div className="text-2xl font-black text-slate-900 group-hover:text-emerald-500 transition-colors tracking-tight">{product.name}</div>
                          {product.barcode && <div className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest">{product.barcode}</div>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell py-8">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">M: {product.brand || "GENÉRICA"}</span>
                          <span className="text-xs font-bold text-slate-900 uppercase italic tracking-tight">{product.category || "SIN CAT."}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-8">
                        <div className={cn(
                          "inline-flex flex-col items-center justify-center min-w-[72px] h-[72px] rounded-[24px]",
                          product.stock_quantity === 0 ? "bg-rose-50 text-rose-600 shadow-sm" : 
                          product.stock_quantity <= product.min_stock ? "bg-orange-50 text-orange-600" : "bg-emerald-50 text-emerald-600"
                        )}>
                          <span className="text-2xl font-black tracking-tighter italic">{product.stock_quantity}</span>
                          <span className="text-[9px] font-black uppercase opacity-60">uds</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-8">
                        <div className="text-lg font-black text-slate-300 italic tracking-tighter">
                          MT: {product.min_stock}
                        </div>
                      </TableCell>
                      <TableCell className="py-8 text-right px-8">
                        {product.stock_quantity === 0 ? (
                          <Badge className="bg-rose-500 text-white border-none font-black px-6 py-2 rounded-2xl uppercase text-[10px] tracking-widest shadow-lg shadow-rose-100 italic">AGOTADO</Badge>
                        ) : product.stock_quantity <= product.min_stock ? (
                          <Badge className="bg-orange-400 text-white border-none font-black px-6 py-2 rounded-2xl uppercase text-[10px] tracking-widest shadow-lg shadow-orange-100 italic">BAJO STOCK</Badge>
                        ) : (
                          <Badge className="bg-emerald-500 text-white border-none font-black px-6 py-2 rounded-2xl uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-100 italic">ÓPTIMO</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
