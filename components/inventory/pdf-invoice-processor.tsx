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
  
  const resetForm = () => {
    setSelectedFile(null)
    setResult(null)
    setProcessing(false)
    setProgress(0)
    setSelectedProducts(new Set())
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

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
        <Button onClick={resetForm} variant="outline" className="h-16 rounded-3xl border-slate-200 hover:border-slate-300 hover:bg-slate-50 font-black px-8 text-xs uppercase tracking-widest transition-all">
          <FileText className="h-5 w-5 mr-3 text-slate-400" />
          Procesar Factura PDF
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto rounded-[44px] border-none shadow-2xl p-0">
        <div className="bg-[#f8fafc] min-h-full">
          {/* Header del Dialog */}
          <div className="p-10 pb-6">
            <DialogHeader>
              <DialogTitle className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white">
                  <Package className="h-6 w-6" />
                </div>
                Extraccion <span className="text-emerald-500">Inteligente.</span>
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-10 pb-10 space-y-8">
            {/* Instrucciones con Big UI Alert */}
            <div className="p-8 bg-white rounded-[32px] border border-slate-100 shadow-sm flex items-start gap-6">
              <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-2">Protocolo de Importación</h4>
                <p className="text-slate-500 font-medium leading-relaxed">
                  Sube una factura en PDF de tu proveedor. El motor de IA identificará automáticamente los productos, 
                  calculará costos basados en un <span className="text-slate-900 font-black">16% IVA</span> y sugerirá 
                  precios de venta con un <span className="text-slate-900 font-black">35% de margen operativo.</span>
                </p>
              </div>
            </div>

            {/* Selección de archivo */}
            <div className="space-y-4">
              <Label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Canal de Carga de Factura</Label>
              <div className="group relative">
                <Input
                  id="pdf-file"
                  type="file"
                  accept=".pdf"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-slate-200 rounded-[32px] bg-white group-hover:border-emerald-400 group-hover:bg-emerald-50 transition-all flex flex-col items-center justify-center gap-3"
                >
                  <Upload className="h-8 w-8 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                  <span className="text-sm font-black text-slate-400 group-hover:text-emerald-600 transition-colors uppercase tracking-widest">
                    {selectedFile ? selectedFile.name : "Click para cargar o arrastra tu PDF aquí"}
                  </span>
                </Button>
              </div>

              {selectedFile && !result && !processing && (
                <div className="flex justify-center pt-4">
                  <Button onClick={processInvoice} className="h-16 px-12 rounded-3xl bg-slate-900 text-white font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">
                    <Upload className="h-5 w-5 mr-3" />
                    Iniciar Procesamiento
                  </Button>
                </div>
              )}
            </div>

            {/* Progreso */}
            {processing && (
              <div className="p-10 bg-white rounded-[40px] shadow-sm animate-pulse">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-xl font-black text-slate-900 tracking-tighter">Analizando Estructura PDF...</span>
                  <span className="text-2xl font-black text-emerald-500 italic">{progress}%</span>
                </div>
                <Progress value={progress} className="h-4 bg-slate-100 rounded-full overflow-hidden" />
              </div>
            )}

            {/* Resultados */}
            {result && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Información de la factura */}
                <Card className="border-none shadow-sm rounded-[40px] bg-white p-8">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Metadata de Factura</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
                    <div>
                      <Label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Proveedor</Label>
                      <p className="text-xl font-black text-slate-900 tracking-tight mt-1">{result.invoiceInfo.supplier || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Folio Fiscal</Label>
                      <p className="text-xl font-black text-slate-900 tracking-tight mt-1">#{result.invoiceInfo.folio || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Fecha Emision</Label>
                      <p className="text-xl font-black text-slate-900 tracking-tight mt-1 italic">{result.invoiceInfo.date || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Monto Total</Label>
                      <p className="text-3xl font-black text-emerald-500 tracking-tighter mt-1 italic">${result.invoiceInfo.total.toFixed(2)}</p>
                    </div>
                  </div>
                </Card>

                {/* Productos extraídos */}
                {result.extractedProducts.length > 0 && (
                  <Card className="border-none shadow-sm rounded-[44px] overflow-hidden bg-white p-4">
                    <CardHeader className="p-8 pb-4">
                      <CardTitle className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div>
                          <span className="text-3xl font-black text-slate-900 tracking-tighter">Items Detectados.</span>
                          <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">{result.extractedProducts.length} registros extraídos</p>
                        </div>
                        <div className="flex gap-3">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setSelectedProducts(new Set(result.extractedProducts.map((_, i) => i)))}
                            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-500"
                          >
                            Seleccionar Todo
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setSelectedProducts(new Set())}
                            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500"
                          >
                            Limpiar
                          </Button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-slate-50 hover:bg-transparent">
                              <TableHead className="w-16 px-8 h-16"></TableHead>
                              <TableHead className="h-16 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">CANT.</TableHead>
                              <TableHead className="h-16 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">CLAVE / SKU</TableHead>
                              <TableHead className="h-16 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">DESCRIPCIÓN</TableHead>
                              <TableHead className="h-16 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">COSTO FINAL</TableHead>
                              <TableHead className="h-16 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">P. VENTA</TableHead>
                              <TableHead className="h-16 px-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">CATEGORÍA</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.extractedProducts.map((product, index) => (
                              <TableRow key={index} className="group border-slate-50 hover:bg-slate-50/50 transition-colors">
                                <TableCell className="px-8 py-6">
                                  <div className="flex items-center justify-center">
                                    <input
                                      type="checkbox"
                                      checked={selectedProducts.has(index)}
                                      onChange={() => toggleProductSelection(index)}
                                      className="w-6 h-6 rounded-lg border-2 border-slate-200 checked:bg-emerald-500 checked:border-emerald-500 transition-all cursor-pointer"
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="py-6 font-black text-lg text-slate-900 italic">
                                  {product.quantity}
                                </TableCell>
                                <TableCell className="py-6">
                                  <Badge className="bg-slate-100 text-slate-600 border-none font-black px-4 py-1.5 rounded-xl uppercase text-[10px] tracking-widest italic">
                                    {product.clave}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-6 max-w-xs">
                                  <div className="text-sm font-bold text-slate-900 uppercase leading-relaxed tracking-tight" title={product.description}>
                                    {product.description}
                                  </div>
                                </TableCell>
                                <TableCell className="py-6">
                                  <div className="text-xl font-black text-blue-500 tracking-tighter">
                                    ${product.cost.toFixed(2)}
                                  </div>
                                </TableCell>
                                <TableCell className="py-6">
                                  <div className="text-xl font-black text-emerald-500 tracking-tighter shadow-[0_0_20px_rgba(16,185,129,0.1)] inline-block">
                                    ${product.sellingPrice.toFixed(2)}
                                  </div>
                                </TableCell>
                                <TableCell className="py-6 px-8">
                                  <Badge className="bg-emerald-50 text-emerald-600 border-none font-black px-4 py-1.5 rounded-xl uppercase text-[10px] tracking-widest italic whitespace-nowrap">
                                    {product.suggestedCategory}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Botones de acción final */}
                {result.extractedProducts.length > 0 && (
                  <div className="flex flex-col md:flex-row justify-end items-center gap-6 p-8 bg-slate-100/50 rounded-[40px] border border-slate-100">
                    <div className="flex-1">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Confirmacion Final</p>
                      <p className="text-xl font-black text-slate-900 tracking-tighter">Se integrarán <span className="text-emerald-500 italic">{selectedProducts.size}</span> nuevos productos al catálogo.</p>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                      <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-16 flex-1 md:flex-none px-10 rounded-3xl font-black uppercase text-xs tracking-widest text-slate-400">Descartar</Button>
                      <Button
                        onClick={saveSelectedProducts}
                        disabled={selectedProducts.size === 0 || saving}
                        className="h-16 flex-1 md:flex-none px-12 rounded-3xl bg-[#10b981] text-white font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all"
                      >
                        <Save className="h-5 w-5 mr-3" />
                        {saving ? "Integrando..." : "Integrar al Sistema"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
