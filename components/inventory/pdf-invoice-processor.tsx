"use client"

import type React from "react"

import { useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { FileText, Upload, XCircle, AlertTriangle, Package, Save } from "lucide-react"

interface ExtractedProduct {
  quantity: number
  clave: string
  description: string
  unitPriceWithoutTax: number
  cost: number // Precio + 16% IVA
  sellingPrice: number // Costo + 35%
  total: number
  suggestedName: string
  suggestedCategory: string
  suggestedBrand: string
}

interface ProcessingResult {
  success: boolean
  extractedProducts: ExtractedProduct[]
  errors: string[]
  warnings: string[]
  invoiceInfo: {
    supplier: string
    date: string
    folio: string
    total: number
  }
}

export default function PDFInvoiceProcessor() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ProcessingResult | null>(null)
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Función para extraer texto del PDF usando la API route
  const extractTextFromPDF = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch("/api/parse-invoice", {
        method: "POST",
        body: formData,
      })

      // Verificar si la respuesta es exitosa
      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = "Error al procesar el PDF"

        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = `Error del servidor: ${response.status}`
        }

        throw new Error(errorMessage)
      }

      // Verificar que la respuesta sea JSON válido
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Respuesta inválida del servidor")
      }

      const data = await response.json()

      if (!data.success || !data.text) {
        throw new Error(data.error || "No se pudo extraer texto del PDF")
      }

      return data.text
    } catch (error) {
      console.error("Error in extractTextFromPDF:", error)
      throw error
    }
  }

  // Función para procesar el texto extraído y identificar productos
  const processExtractedText = (text: string): ProcessingResult => {
    const lines = text.split("\n").filter((line) => line.trim())
    const products: ExtractedProduct[] = []
    const invoiceInfo = {
      supplier: "",
      date: "",
      folio: "",
      total: 0,
    }

    // Extraer información de la factura
    for (const line of lines) {
      // Buscar proveedor
      if (line.includes("HABROS BICICLETAS") || line.includes("HABROS")) {
        invoiceInfo.supplier = "HABROS BICICLETAS"
      }

      // Buscar folio
      const folioMatch = line.match(/(?:Folio|FOLIO):\s*([A-Z]?\d+)/i)
      if (folioMatch) {
        invoiceInfo.folio = folioMatch[1]
      }

      // Buscar fecha
      const dateMatch = line.match(/(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i)
      if (dateMatch) {
        invoiceInfo.date = dateMatch[1]
      }

      // Buscar total
      const totalMatch = line.match(/Total[:\s]*(\d+\.?\d*)/i)
      if (totalMatch) {
        invoiceInfo.total = Number.parseFloat(totalMatch[1])
      }
    }

    // Patrones mejorados para identificar productos en facturas mexicanas
    // Buscar líneas que contengan: Cantidad, Clave, Descripción, Precio
    const productPatterns = [
      // Patrón principal: Cantidad Clave Descripción Precio Importe
      /(\d+)\s+(\d+)\s+(.+?)\s+(\d+\.?\d*)\s+(\d+\.?\d*)/,
      // Patrón alternativo con más espacios
      /(\d+)\s+(\w+\d+)\s+(.+?)\s+(\d+\.?\d*)\s+(\d+\.?\d*)/,
      // Patrón para líneas con clave SAT
      /(\d+)\s+\d+\s+(\d+)\s+(.+?)\s+(\d+\.?\d*)\s+(\d+\.?\d*)/,
    ]

    let currentQuantity = 0
    let currentClave = ""
    let currentDescription = ""
    let currentPrice = 0
    let currentTotal = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // Buscar patrones de productos
      for (const pattern of productPatterns) {
        const match = line.match(pattern)
        if (match) {
          const [, quantity, clave, description, price, total] = match

          // Limpiar datos
          const cleanQuantity = Number.parseInt(quantity)
          const cleanClave = clave.toString()
          const cleanDescription = description.trim()
          const cleanPrice = Number.parseFloat(price)
          const cleanTotal = Number.parseFloat(total)

          // Validar que los datos sean coherentes
          if (cleanQuantity > 0 && cleanPrice > 0 && cleanDescription.length > 3) {
            // Calcular precios según especificaciones
            const cost = cleanPrice * 1.16 // Agregar 16% de IVA
            const sellingPrice = cost * 1.35 // Agregar 35% de ganancia

            // Sugerir datos del producto
            const suggestedData = suggestProductData(cleanDescription)

            products.push({
              quantity: cleanQuantity,
              clave: cleanClave,
              description: cleanDescription,
              unitPriceWithoutTax: cleanPrice,
              cost: Math.round(cost * 100) / 100,
              sellingPrice: Math.round(sellingPrice * 100) / 100,
              total: cleanTotal,
              suggestedName: suggestedData.name,
              suggestedCategory: suggestedData.category,
              suggestedBrand: suggestedData.brand,
            })
          }
          break
        }
      }

      // También buscar líneas que puedan estar divididas
      if (line.match(/^\d+\s+\d+$/)) {
        const parts = line.split(/\s+/)
        if (parts.length >= 2) {
          currentQuantity = Number.parseInt(parts[0])
          currentClave = parts[1]
        }
      } else if (currentQuantity > 0 && line.match(/^[A-Z\s]+/)) {
        currentDescription = line.trim()
      } else if (currentQuantity > 0 && currentDescription && line.match(/^\d+\.?\d*\s+\d+\.?\d*$/)) {
        const prices = line.split(/\s+/)
        if (prices.length >= 2) {
          currentPrice = Number.parseFloat(prices[0])
          currentTotal = Number.parseFloat(prices[1])

          if (currentPrice > 0 && currentDescription.length > 3) {
            const cost = currentPrice * 1.16
            const sellingPrice = cost * 1.35
            const suggestedData = suggestProductData(currentDescription)

            products.push({
              quantity: currentQuantity,
              clave: currentClave,
              description: currentDescription,
              unitPriceWithoutTax: currentPrice,
              cost: Math.round(cost * 100) / 100,
              sellingPrice: Math.round(sellingPrice * 100) / 100,
              total: currentTotal,
              suggestedName: suggestedData.name,
              suggestedCategory: suggestedData.category,
              suggestedBrand: suggestedData.brand,
            })
          }

          // Reset
          currentQuantity = 0
          currentClave = ""
          currentDescription = ""
          currentPrice = 0
          currentTotal = 0
        }
      }
    }

    return {
      success: products.length > 0,
      extractedProducts: products,
      errors: products.length === 0 ? ["No se pudieron extraer productos de la factura"] : [],
      warnings: products.length < 2 ? ["Se encontraron pocos productos, verifica el formato de la factura"] : [],
      invoiceInfo,
    }
  }

  // Función para sugerir datos del producto basado en la descripción
  const suggestProductData = (description: string) => {
    const desc = description.toLowerCase()

    let category = "Repuestos"
    let brand = ""

    // Categorización basada en palabras clave de bicicletas
    if (desc.includes("cambio") || desc.includes("tras") || desc.includes("desv")) {
      category = "Transmisión"
    } else if (desc.includes("palanc") || desc.includes("palanca") || desc.includes("freno")) {
      category = "Frenos"
    } else if (desc.includes("llanta") || desc.includes("rin") || desc.includes("rueda")) {
      category = "Ruedas"
    } else if (desc.includes("cadena") || desc.includes("chain")) {
      category = "Transmisión"
    } else if (desc.includes("pedal")) {
      category = "Pedales"
    } else if (desc.includes("asiento") || desc.includes("silla")) {
      category = "Asientos"
    } else if (desc.includes("manubrio") || desc.includes("manillar")) {
      category = "Dirección"
    } else if (desc.includes("luz") || desc.includes("faro")) {
      category = "Iluminación"
    } else if (desc.includes("casco")) {
      category = "Seguridad"
    }

    // Detección de marca
    if (desc.includes("shine") || desc.includes("shin")) {
      brand = "Shine"
    } else if (desc.includes("shimano")) {
      brand = "Shimano"
    } else if (desc.includes("sram")) {
      brand = "SRAM"
    } else if (desc.includes("trek")) {
      brand = "Trek"
    } else if (desc.includes("giant")) {
      brand = "Giant"
    } else if (desc.includes("specialized")) {
      brand = "Specialized"
    }

    // Limpiar el nombre del producto
    const name = description
      .replace(/\b\d+\b/g, "") // Remover números sueltos
      .replace(/\s+/g, " ") // Normalizar espacios
      .trim()

    return {
      name,
      category,
      brand,
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === "application/pdf") {
      setSelectedFile(file)
      setResult(null)
      setSelectedProducts(new Set())
    } else {
      alert("Por favor selecciona un archivo PDF válido")
    }
  }

  const processInvoice = async () => {
    if (!selectedFile) return

    setProcessing(true)
    setProgress(0)

    try {
      setProgress(20)

      // Extraer texto del PDF usando la API
      const extractedText = await extractTextFromPDF(selectedFile)
      setProgress(60)

      // Procesar el texto extraído
      const processingResult = processExtractedText(extractedText)
      setProgress(100)

      setResult(processingResult)

      // Seleccionar todos los productos por defecto
      if (processingResult.extractedProducts.length > 0) {
        setSelectedProducts(new Set(processingResult.extractedProducts.map((_, index) => index)))
      }
    } catch (error) {
      console.error("Error processing invoice:", error)
      setResult({
        success: false,
        extractedProducts: [],
        errors: [error instanceof Error ? error.message : "Error desconocido al procesar la factura"],
        warnings: [],
        invoiceInfo: { supplier: "", date: "", folio: "", total: 0 },
      })
    } finally {
      setProcessing(false)
    }
  }

  const toggleProductSelection = (index: number) => {
    const newSelection = new Set(selectedProducts)
    if (newSelection.has(index)) {
      newSelection.delete(index)
    } else {
      newSelection.add(index)
    }
    setSelectedProducts(newSelection)
  }

  const saveSelectedProducts = async () => {
    if (!result || selectedProducts.size === 0) return

    setSaving(true)
    try {
      const productsToSave = result.extractedProducts.filter((_, index) => selectedProducts.has(index))

      let successCount = 0
      const errors: string[] = []

      for (const product of productsToSave) {
        try {
          // Verificar si ya existe un producto con la misma clave/SKU
          const { data: existingProduct } = await supabase
            .from("products")
            .select("id")
            .eq("sku", product.clave)
            .single()

          if (existingProduct) {
            errors.push(`Producto con clave ${product.clave} ya existe`)
            continue
          }

          const productData = {
            name: product.suggestedName,
            description: product.description,
            sku: product.clave,
            category: product.suggestedCategory,
            brand: product.suggestedBrand,
            cost: product.cost,
            price: product.sellingPrice,
            public_price: product.sellingPrice,
            wholesale_price: product.sellingPrice, // Mismo precio inicialmente
            stock_quantity: product.quantity,
            min_stock: Math.max(1, Math.floor(product.quantity * 0.1)),
            has_variants: false,
          }

          const { data: insertedProduct, error } = await supabase
            .from("products")
            .insert([productData])
            .select()
            .single()

          if (error) throw error
          successCount++

          // Registrar movimiento de inventario
          await supabase.from("inventory_movements").insert([
            {
              product_id: insertedProduct.id,
              movement_type: "entrada",
              quantity: product.quantity,
              reason: `Entrada por factura ${result.invoiceInfo.folio} - ${result.invoiceInfo.supplier}`,
              reference_id: result.invoiceInfo.folio,
            },
          ])
        } catch (error) {
          errors.push(`Error al guardar ${product.suggestedName}: ${error}`)
        }
      }

      if (successCount > 0) {
        alert(`Se guardaron ${successCount} productos exitosamente`)
        setIsDialogOpen(false)
        setSelectedFile(null)
        setResult(null)
        setSelectedProducts(new Set())

        // Limpiar el input de archivo
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }

      if (errors.length > 0) {
        console.error("Errores al guardar productos:", errors)
        alert(`Se guardaron ${successCount} productos. ${errors.length} errores encontrados.`)
      }
    } catch (error) {
      console.error("Error saving products:", error)
      alert("Error al guardar los productos")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-blue-50 border-blue-200 hover:bg-blue-100">
          <FileText className="h-4 w-4 mr-2" />
          Procesar Factura PDF
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Extraer Productos de Factura PDF
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Instrucciones */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Instrucciones:</strong> Sube una factura en PDF de tu proveedor. El sistema extraerá
              automáticamente los productos usando la CLAVE como SKU, calculará el costo (precio + 16% IVA) y el precio
              de venta (costo + 35%).
            </AlertDescription>
          </Alert>

          {/* Selección de archivo */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pdf-file">Seleccionar Factura PDF</Label>
              <Input id="pdf-file" type="file" accept=".pdf" ref={fileInputRef} onChange={handleFileSelect} />
            </div>

            {selectedFile && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">{selectedFile.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </Badge>
                    </div>
                    <Button onClick={processInvoice} disabled={processing} size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      {processing ? "Procesando..." : "Procesar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Progreso */}
          {processing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Procesando factura...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Resultados */}
          {result && (
            <div className="space-y-4">
              {/* Información de la factura */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Información de la Factura</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm text-gray-600">Proveedor</Label>
                    <p className="font-medium">{result.invoiceInfo.supplier || "No detectado"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Folio</Label>
                    <p className="font-medium">{result.invoiceInfo.folio || "No detectado"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Fecha</Label>
                    <p className="font-medium">{result.invoiceInfo.date || "No detectada"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Total</Label>
                    <p className="font-medium">${result.invoiceInfo.total.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Alertas */}
              {result.errors.length > 0 && (
                <Alert className="border-red-200 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription>
                    <strong>Errores:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {result.errors.map((error, i) => (
                        <li key={i} className="text-sm">
                          {error}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {result.warnings.length > 0 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription>
                    <strong>Advertencias:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {result.warnings.map((warning, i) => (
                        <li key={i} className="text-sm">
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Productos extraídos */}
              {result.extractedProducts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Productos Extraídos ({result.extractedProducts.length})</span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedProducts(new Set(result.extractedProducts.map((_, i) => i)))}
                        >
                          Seleccionar Todos
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setSelectedProducts(new Set())}>
                          Deseleccionar Todos
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">
                              <input
                                type="checkbox"
                                checked={selectedProducts.size === result.extractedProducts.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedProducts(new Set(result.extractedProducts.map((_, i) => i)))
                                  } else {
                                    setSelectedProducts(new Set())
                                  }
                                }}
                              />
                            </TableHead>
                            <TableHead>Cant.</TableHead>
                            <TableHead>Clave (SKU)</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead>Precio s/IVA</TableHead>
                            <TableHead>Costo c/IVA</TableHead>
                            <TableHead>Precio Venta</TableHead>
                            <TableHead>Categoría</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.extractedProducts.map((product, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <input
                                  type="checkbox"
                                  checked={selectedProducts.has(index)}
                                  onChange={() => toggleProductSelection(index)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{product.quantity}</TableCell>
                              <TableCell className="font-mono text-sm">{product.clave}</TableCell>
                              <TableCell className="max-w-xs">
                                <div className="truncate" title={product.description}>
                                  {product.description}
                                </div>
                              </TableCell>
                              <TableCell>${product.unitPriceWithoutTax.toFixed(2)}</TableCell>
                              <TableCell className="font-medium text-blue-600">${product.cost.toFixed(2)}</TableCell>
                              <TableCell className="font-medium text-green-600">
                                ${product.sellingPrice.toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{product.suggestedCategory}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Botones de acción */}
              {result.extractedProducts.length > 0 && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={saveSelectedProducts}
                    disabled={selectedProducts.size === 0 || saving}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Guardando..." : `Guardar ${selectedProducts.size} Productos`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
