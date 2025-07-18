"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Plus, Package } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"

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

interface ProductSelectorProps {
  onProductSelect: (
    product: Product,
    quantity: number,
    variant?: ProductVariant,
    priceType?: "public" | "wholesale",
  ) => void
  excludeProductIds?: string[]
}

export default function ProductSelector({ onProductSelect, excludeProductIds = [] }: ProductSelectorProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [priceType, setPriceType] = useState<"public" | "wholesale">("public")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    filterProducts()
  }, [searchTerm, products, excludeProductIds])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from("products").select("*").gt("stock_quantity", 0).order("name")

      if (error) throw error

      // Para cada producto, obtener sus variantes si las tiene
      const productsWithVariants = await Promise.all(
        (data || []).map(async (product) => {
          if (product.has_variants) {
            const { data: variantsData } = await supabase
              .from("product_variants")
              .select("*")
              .eq("product_id", product.id)
              .eq("is_active", true)
              .gt("stock_quantity", 0)
              .order("name")

            return {
              ...product,
              variants: variantsData || [],
            }
          }
          return product
        }),
      )

      setProducts(productsWithVariants)
    } catch (error) {
      console.error("Error fetching products:", error)
    } finally {
      setLoading(false)
    }
  }

  const filterProducts = () => {
    const filtered = products.filter((product) => {
      // Excluir productos ya seleccionados
      if (excludeProductIds.includes(product.id)) return false

      // Filtrar por búsqueda
      const matchesSearch =
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase()))

      // Solo mostrar productos con stock disponible
      const hasStock = product.has_variants
        ? product.variants && product.variants.length > 0 && product.variants.some((v) => v.stock_quantity > 0)
        : product.stock_quantity > 0

      return matchesSearch && hasStock
    })

    setFilteredProducts(filtered)
  }

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product)
    setSelectedVariant(null)
    setQuantity(1)
    setPriceType("public")

    // Si el producto no tiene variantes, podemos agregarlo directamente
    if (!product.has_variants) {
      // No abrir diálogo, agregar directamente
      return
    }

    setIsDialogOpen(true)
  }

  const handleAddProduct = () => {
    if (!selectedProduct) return

    const productToAdd = selectedProduct
    const variantToAdd = selectedVariant

    // Validar stock disponible
    const availableStock = variantToAdd ? variantToAdd.stock_quantity : productToAdd.stock_quantity
    if (quantity > availableStock) {
      alert(`Stock insuficiente. Disponible: ${availableStock}`)
      return
    }

    onProductSelect(productToAdd, quantity, variantToAdd, priceType)

    // Limpiar selección
    setSelectedProduct(null)
    setSelectedVariant(null)
    setQuantity(1)
    setPriceType("public")
    setIsDialogOpen(false)
    setSearchTerm("")
  }

  const handleQuickAdd = (product: Product) => {
    if (product.has_variants && product.variants && product.variants.length > 1) {
      // Si tiene múltiples variantes, abrir diálogo
      handleProductSelect(product)
    } else {
      // Si no tiene variantes o solo tiene una, agregar directamente
      const variant = product.has_variants && product.variants ? product.variants[0] : undefined
      onProductSelect(product, 1, variant, "public")
    }
  }

  const getCurrentPrice = () => {
    if (selectedVariant) {
      return priceType === "wholesale" ? selectedVariant.wholesale_price : selectedVariant.public_price
    }
    if (selectedProduct) {
      return priceType === "wholesale" ? selectedProduct.wholesale_price : selectedProduct.public_price
    }
    return 0
  }

  const getAvailableStock = () => {
    if (selectedVariant) {
      return selectedVariant.stock_quantity
    }
    if (selectedProduct) {
      return selectedProduct.stock_quantity
    }
    return 0
  }

  return (
    <div className="space-y-4">
      {/* Buscador de productos */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Buscar productos por nombre, marca o código..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Lista de productos */}
      {searchTerm && (
        <div className="max-h-60 overflow-y-auto border rounded-md">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Buscando productos...</div>
          ) : filteredProducts.length > 0 ? (
            <div className="space-y-1 p-2">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-md cursor-pointer border"
                  onClick={() => handleQuickAdd(product)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{product.name}</span>
                      {product.has_variants && (
                        <Badge variant="outline" className="text-xs">
                          <Package className="h-3 w-3 mr-1" />
                          {product.variants?.length || 0} variantes
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {product.brand} • {product.category}
                    </div>
                    <div className="text-sm">
                      <span className="text-green-600 font-medium">Público: ${product.public_price.toFixed(2)}</span>
                      <span className="mx-2">•</span>
                      <span className="text-blue-600 font-medium">Puesto: ${product.wholesale_price.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">
                      Stock:{" "}
                      {product.has_variants
                        ? product.variants?.reduce((sum, v) => sum + v.stock_quantity, 0) || 0
                        : product.stock_quantity}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">No se encontraron productos</div>
          )}
        </div>
      )}

      {/* Diálogo para configurar producto con variantes */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Producto</DialogTitle>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">{selectedProduct.name}</h3>
                <p className="text-sm text-gray-500">
                  {selectedProduct.brand} • {selectedProduct.category}
                </p>
              </div>

              {/* Selección de variante */}
              {selectedProduct.has_variants && selectedProduct.variants && selectedProduct.variants.length > 0 && (
                <div className="space-y-2">
                  <Label>Variante</Label>
                  <Select
                    value={selectedVariant?.id || ""}
                    onValueChange={(value) => {
                      const variant = selectedProduct.variants?.find((v) => v.id === value)
                      setSelectedVariant(variant || null)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar variante" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProduct.variants.map((variant) => (
                        <SelectItem key={variant.id} value={variant.id}>
                          <div className="flex justify-between items-center w-full">
                            <span>{variant.name}</span>
                            <Badge variant="secondary" className="ml-2">
                              Stock: {variant.stock_quantity}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Tipo de precio */}
              <div className="space-y-2">
                <Label>Tipo de Precio</Label>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="price-type"
                      checked={priceType === "wholesale"}
                      onCheckedChange={(checked) => setPriceType(checked ? "wholesale" : "public")}
                    />
                    <Label htmlFor="price-type" className="text-sm">
                      {priceType === "wholesale" ? "Precio Puesto" : "Precio Público"}
                    </Label>
                  </div>
                </div>
                <div className="text-lg font-bold text-center p-2 bg-gray-50 rounded">
                  ${getCurrentPrice().toFixed(2)}
                </div>
              </div>

              {/* Cantidad */}
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    min="1"
                    max={getAvailableStock()}
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(Math.max(1, Math.min(getAvailableStock(), Number.parseInt(e.target.value) || 1)))
                    }
                    className="w-20 text-center"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.min(getAvailableStock(), quantity + 1))}
                    disabled={quantity >= getAvailableStock()}
                  >
                    +
                  </Button>
                </div>
                <p className="text-xs text-gray-500">Stock disponible: {getAvailableStock()}</p>
              </div>

              {/* Total */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total:</span>
                  <span>${(getCurrentPrice() * quantity).toFixed(2)}</span>
                </div>
              </div>

              {/* Botones */}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddProduct} disabled={selectedProduct.has_variants && !selectedVariant}>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
