"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus,
  Edit,
  Trash2,
  Search,
  AlertTriangle,
  Package,
  Settings,
  Download,
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  EyeOff,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

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
  description: string
  barcode: string
  sku: string | null
  price: number // Mantenemos para compatibilidad
  cost: number
  public_price: number
  wholesale_price: number
  category: string
  brand: string
  stock_quantity: number
  min_stock: number
  has_variants: boolean
  is_active: boolean // Added is_active property
  variants?: ProductVariant[]
}

interface ImportResult {
  success: number
  errors: string[]
  warnings: string[]
}

interface CSVRow {
  [key: string]: string
}

export default function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedBrand, setBrand] = useState("")
  const [categories, setCategories] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isVariantsDialogOpen, setIsVariantsDialogOpen] = useState(false)
  const [selectedProductForVariants, setSelectedProductForVariants] = useState<Product | null>(null)
  const [variants, setVariants] = useState<ProductVariant[]>([])

  // Import/Export states
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Category management states
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    barcode: "",
    sku: "",
    public_price: "",
    wholesale_price: "",
    category: "",
    brand: "",
    stock_quantity: "",
    min_stock: "",
    has_variants: false,
  })

  // Estado para nueva variante
  const [newVariant, setNewVariant] = useState({
    name: "",
    sku: "",
    barcode: "",
    public_price: "",
    wholesale_price: "",
    stock_quantity: "",
    min_stock: "",
  })

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from("products").select("*").order("name")

      if (error) throw error

      // Para cada producto, obtener sus variantes si las tiene
      const productsWithVariants = await Promise.all(
        (data || []).map(async (product) => {
          if (product.has_variants) {
            const { data: variantsData } = await supabase
              .from("product_variants")
              .select("*")
              .eq("product_id", product.id)
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
      getFiltersData(productsWithVariants)
    } catch (error) {
      console.error("Error fetching products:", error)
    } finally {
      setLoading(false)
    }
  }

  const getFiltersData = (products: Product[]) => {
    const uniqueCategories = [...new Set(products.map((p) => p.category).filter(Boolean))]
    const uniqueBrands = [...new Set(products.map((p) => p.brand).filter(Boolean))]
    setCategories(uniqueCategories.sort())
    setBrands(uniqueBrands.sort())
  }

  // CSV Export functionality - Formato simplificado
  const exportToCSV = () => {
    const csvData: any[] = []

    products.forEach((product) => {
      if (product.has_variants && product.variants && product.variants.length > 0) {
        // Producto principal con variantes
        csvData.push({
          nombre: product.name,
          sku: product.sku || "",
          codigo_barras: product.barcode || "",
          precio_publico: product.public_price || product.price || 0,
          precio_puesto: product.wholesale_price || 0,
          categoria: product.category || "",
          marca: product.brand || "",
          tiene_variantes: "SI",
          variante_nombre: "",
          variante_sku: "",
          variante_codigo_barras: "",
          variante_precio_publico: "",
          variante_precio_puesto: "",
          variante_stock: "",
          variante_stock_minimo: "",
          stock: product.stock_quantity,
          stock_minimo: product.min_stock,
          descripcion: product.description || "",
        })

        // Agregar cada variante como fila separada
        product.variants.forEach((variant) => {
          csvData.push({
            nombre: "",
            sku: "",
            codigo_barras: "",
            precio_publico: "",
            precio_puesto: "",
            categoria: "",
            marca: "",
            tiene_variantes: "",
            variante_nombre: variant.name,
            variante_sku: variant.sku || "",
            variante_codigo_barras: variant.barcode || "",
            variante_precio_publico: variant.public_price,
            variante_precio_puesto: variant.wholesale_price,
            variante_stock: variant.stock_quantity,
            variante_stock_minimo: variant.min_stock,
            stock: "",
            stock_minimo: "",
            descripcion: "",
          })
        })
      } else {
        // Producto simple sin variantes
        csvData.push({
          nombre: product.name,
          sku: product.sku || "",
          codigo_barras: product.barcode || "",
          precio_publico: product.public_price || product.price || 0,
          precio_puesto: product.wholesale_price || 0,
          categoria: product.category || "",
          marca: product.brand || "",
          tiene_variantes: "NO",
          variante_nombre: "",
          variante_sku: "",
          variante_codigo_barras: "",
          variante_precio_publico: "",
          variante_precio_puesto: "",
          variante_stock: "",
          variante_stock_minimo: "",
          stock: product.stock_quantity,
          stock_minimo: product.min_stock,
          descripcion: product.description || "",
        })
      }
    })

    const headers = [
      "nombre",
      "sku",
      "codigo_barras",
      "precio_publico",
      "precio_puesto",
      "categoria",
      "marca",
      "tiene_variantes",
      "variante_nombre",
      "variante_sku",
      "variante_codigo_barras",
      "variante_precio_publico",
      "variante_precio_puesto",
      "variante_stock",
      "variante_stock_minimo",
      "stock",
      "stock_minimo",
      "descripcion",
    ]

    const csvContent = [
      headers.join(","),
      ...csvData.map((row) =>
        headers
          .map((header) => {
            const value = row[header]?.toString() || ""
            // Escape commas and quotes in CSV
            return value.includes(",") || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value
          })
          .join(","),
      ),
    ].join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `productos_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Download CSV template - Plantilla simplificada
  const downloadTemplate = () => {
    const templateData = [
      {
        nombre: "Bicicleta Mountain Bike",
        sku: "MTB-001",
        codigo_barras: "1234567890123",
        precio_publico: "299.99",
        precio_puesto: "199.99",
        categoria: "Bicicletas",
        marca: "Trek",
        tiene_variantes: "NO",
        variante_nombre: "",
        variante_sku: "",
        variante_codigo_barras: "",
        variante_precio_publico: "",
        variante_precio_puesto: "",
        variante_stock: "",
        variante_stock_minimo: "",
        stock: "10",
        stock_minimo: "2",
        descripcion: "Bicicleta de montaña con suspensión delantera",
      },
      {
        nombre: "Casco de Seguridad",
        sku: "CASCO-001",
        codigo_barras: "1234567890124",
        precio_publico: "49.99",
        precio_puesto: "29.99",
        categoria: "Accesorios",
        marca: "Bell",
        tiene_variantes: "SI",
        variante_nombre: "",
        variante_sku: "",
        variante_codigo_barras: "",
        variante_precio_publico: "",
        variante_precio_puesto: "",
        variante_stock: "",
        variante_stock_minimo: "",
        stock: "0",
        stock_minimo: "3",
        descripcion: "Casco de seguridad para ciclismo con ventilación",
      },
      {
        nombre: "",
        sku: "",
        codigo_barras: "",
        precio_publico: "",
        precio_puesto: "",
        categoria: "",
        marca: "",
        tiene_variantes: "",
        variante_nombre: "Talla M",
        variante_sku: "CASCO-M",
        variante_codigo_barras: "1234567890125",
        variante_precio_publico: "49.99",
        variante_precio_puesto: "29.99",
        variante_stock: "8",
        variante_stock_minimo: "2",
        stock: "",
        stock_minimo: "",
        descripcion: "",
      },
      {
        nombre: "",
        sku: "",
        codigo_barras: "",
        precio_publico: "",
        precio_puesto: "",
        categoria: "",
        marca: "",
        tiene_variantes: "",
        variante_nombre: "Talla L",
        variante_sku: "CASCO-L",
        variante_codigo_barras: "1234567890126",
        variante_precio_publico: "54.99",
        variante_precio_puesto: "34.99",
        variante_stock: "7",
        variante_stock_minimo: "1",
        stock: "",
        stock_minimo: "",
        descripcion: "",
      },
    ]

    const headers = [
      "nombre",
      "sku",
      "codigo_barras",
      "precio_publico",
      "precio_puesto",
      "categoria",
      "marca",
      "tiene_variantes",
      "variante_nombre",
      "variante_sku",
      "variante_codigo_barras",
      "variante_precio_publico",
      "variante_precio_puesto",
      "variante_stock",
      "variante_stock_minimo",
      "stock",
      "stock_minimo",
      "descripcion",
    ]

    const csvContent = [
      headers.join(","),
      ...templateData.map((row) =>
        headers
          .map((header) => {
            const value = row[header as keyof typeof row]?.toString() || ""
            return value.includes(",") || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value
          })
          .join(","),
      ),
    ].join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "plantilla_productos.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Parse CSV file con soporte UTF-8
  const parseCSV = (csvText: string): CSVRow[] => {
    // Remover BOM si existe
    const cleanText = csvText.replace(/^\uFEFF/, "")
    const lines = cleanText.split("\n").filter((line) => line.trim())
    if (lines.length < 2) return []

    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))
    const rows: CSVRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const values: string[] = []
      let current = ""
      let inQuotes = false

      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === "," && !inQuotes) {
          values.push(current.trim())
          current = ""
        } else {
          current += char
        }
      }
      values.push(current.trim())

      if (values.length === headers.length) {
        const row: CSVRow = {}
        headers.forEach((header, index) => {
          const value = (values[index] as string)?.replace(/"/g, "") || ""
          row[header] = value
        })
        rows.push(row)
      }
    }

    return rows
  }

  // Validate CSV row - Simplificado
  const validateRow = (row: CSVRow, index: number): string[] => {
    const errors: string[] = []

    // Solo validar si es una fila de producto (tiene nombre) o variante (tiene variante_nombre)
    const isProductRow = row.nombre?.trim()
    const isVariantRow = row.variante_nombre?.trim()

    if (!isProductRow && !isVariantRow) {
      return errors // Fila vacía, ignorar
    }

    if (isProductRow) {
      if (!row.nombre?.trim()) {
        errors.push(`Fila ${index + 2}: El nombre del producto es obligatorio`)
      }

      if (row.precio_publico && isNaN(Number(row.precio_publico))) {
        errors.push(`Fila ${index + 2}: Precio público debe ser un número`)
      }

      if (row.precio_puesto && isNaN(Number(row.precio_puesto))) {
        errors.push(`Fila ${index + 2}: Precio puesto debe ser un número`)
      }

      if (row.stock && isNaN(Number(row.stock))) {
        errors.push(`Fila ${index + 2}: Stock debe ser un número`)
      }

      if (row.stock_minimo && isNaN(Number(row.stock_minimo))) {
        errors.push(`Fila ${index + 2}: Stock mínimo debe ser un número`)
      }
    }

    if (isVariantRow) {
      if (row.variante_precio_publico && isNaN(Number(row.variante_precio_publico))) {
        errors.push(`Fila ${index + 2}: Precio público de variante debe ser un número`)
      }

      if (row.variante_precio_puesto && isNaN(Number(row.variante_precio_puesto))) {
        errors.push(`Fila ${index + 2}: Precio puesto de variante debe ser un número`)
      }

      if (row.variante_stock && isNaN(Number(row.variante_stock))) {
        errors.push(`Fila ${index + 2}: Stock de variante debe ser un número`)
      }

      if (row.variante_stock_minimo && isNaN(Number(row.variante_stock_minimo))) {
        errors.push(`Fila ${index + 2}: Stock mínimo de variante debe ser un número`)
      }
    }

    return errors
  }

  // Import CSV data - Simplificado
  const importCSV = async () => {
    if (!importFile) return

    setIsImporting(true)
    setImportProgress(0)
    setImportResult(null)

    try {
      const csvText = await importFile.text()
      const rows = parseCSV(csvText)

      if (rows.length === 0) {
        setImportResult({
          success: 0,
          errors: ["El archivo CSV está vacío o tiene un formato incorrecto"],
          warnings: [],
        })
        return
      }

      const errors: string[] = []
      const warnings: string[] = []
      let successCount = 0

      // Validate all rows first
      rows.forEach((row, index) => {
        const rowErrors = validateRow(row, index)
        errors.push(...rowErrors)
      })

      if (errors.length > 0) {
        setImportResult({ success: 0, errors, warnings })
        return
      }

      // Agrupar filas por producto
      const productGroups: { product: CSVRow; variants: CSVRow[] }[] = []
      let currentProduct: CSVRow | null = null
      let currentVariants: CSVRow[] = []

      for (const row of rows) {
        if (row.nombre?.trim()) {
          // Nueva fila de producto
          if (currentProduct) {
            productGroups.push({ product: currentProduct, variants: currentVariants })
          }
          currentProduct = row
          currentVariants = []
        } else if (row.variante_nombre?.trim() && currentProduct) {
          // Fila de variante
          currentVariants.push(row)
        }
      }

      // Agregar el último grupo
      if (currentProduct) {
        productGroups.push({ product: currentProduct, variants: currentVariants })
      }

      // Process product groups
      for (let i = 0; i < productGroups.length; i++) {
        const { product: row, variants } = productGroups[i]
        setImportProgress((i / productGroups.length) * 100)

        try {
          const hasVariants = row.tiene_variantes?.toLowerCase() === "si" || variants.length > 0

          const productData = {
            name: row.nombre.trim(),
            description: row.descripcion?.trim() || "",
            barcode: row.codigo_barras?.trim() || null,
            sku: row.sku?.trim() || null,
            price: Number(row.precio_publico) || 0,
            cost: Number(row.precio_puesto) * 0.8 || 0,
            public_price: Number(row.precio_publico) || 0,
            wholesale_price: Number(row.precio_puesto) || 0,
            category: row.categoria?.trim() || "",
            brand: row.marca?.trim() || "",
            stock_quantity: hasVariants ? 0 : Number(row.stock) || 0,
            min_stock: Number(row.stock_minimo) || 0,
            has_variants: hasVariants,
          }

          // Buscar producto existente SOLO si tiene código de barras o SKU únicos
          let existingProduct = null

          if (row.codigo_barras?.trim()) {
            const { data } = await supabase
              .from("products")
              .select("*")
              .eq("barcode", row.codigo_barras.trim())
              .maybeSingle()
            existingProduct = data
          }

          if (!existingProduct && row.sku?.trim()) {
            const { data } = await supabase.from("products").select("*").eq("sku", row.sku.trim()).maybeSingle()
            existingProduct = data
          }

          let productId: string

          if (existingProduct) {
            // Update existing product
            const { error } = await supabase.from("products").update(productData).eq("id", existingProduct.id)

            if (error) throw error
            productId = existingProduct.id
            warnings.push(`Producto actualizado: ${row.nombre}`)
          } else {
            // Create new product
            const { data, error } = await supabase.from("products").insert([productData]).select().single()

            if (error) throw error
            productId = data.id
            warnings.push(`Producto creado: ${row.nombre}`)
          }

          // Process variants if any
          for (const variant of variants) {
            const variantData = {
              product_id: productId,
              name: variant.variante_nombre.trim(),
              sku: variant.variante_sku?.trim() || null,
              barcode: variant.variante_codigo_barras?.trim() || null,
              public_price: Number(variant.variante_precio_publico) || 0,
              wholesale_price: Number(variant.variante_precio_puesto) || 0,
              stock_quantity: Number(variant.variante_stock) || 0,
              min_stock: Number(variant.variante_stock_minimo) || 0,
            }

            // Check if variant exists SOLO por código único
            let existingVariant = null
            if (variant.variante_codigo_barras?.trim()) {
              const { data } = await supabase
                .from("product_variants")
                .select("*")
                .eq("barcode", variant.variante_codigo_barras.trim())
                .maybeSingle()
              existingVariant = data
            }

            if (!existingVariant && variant.variante_sku?.trim()) {
              const { data } = await supabase
                .from("product_variants")
                .select("*")
                .eq("sku", variant.variante_sku.trim())
                .maybeSingle()
              existingVariant = data
            }

            if (existingVariant) {
              const { error } = await supabase.from("product_variants").update(variantData).eq("id", existingVariant.id)
              if (error) throw error
              warnings.push(`Variante actualizada: ${variant.variante_nombre}`)
            } else {
              const { error } = await supabase.from("product_variants").insert([variantData])
              if (error) throw error
              warnings.push(`Variante creada: ${variant.variante_nombre}`)
            }
          }

          successCount++
        } catch (error) {
          errors.push(
            `Error en producto ${row.nombre}: ${error instanceof Error ? error.message : "Error desconocido"}`,
          )
        }
      }

      setImportProgress(100)
      setImportResult({ success: successCount, errors, warnings })

      if (successCount > 0) {
        await fetchProducts()
      }
    } catch (error) {
      setImportResult({
        success: 0,
        errors: [`Error al procesar el archivo: ${error instanceof Error ? error.message : "Error desconocido"}`],
        warnings: [],
      })
    } finally {
      setIsImporting(false)
    }
  }

  // Handle new category creation
  const handleAddNewCategory = () => {
    if (newCategoryName.trim()) {
      setFormData({ ...formData, category: newCategoryName.trim() })
      setCategories((prev) => [...prev, newCategoryName.trim()].sort())
      setNewCategoryName("")
      setIsAddingNewCategory(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const productData = {
      name: formData.name,
      description: formData.description,
      barcode: formData.barcode || null,
      sku: formData.sku || null,
      price: Number.parseFloat(formData.public_price), // Mantener para compatibilidad
      cost: Number.parseFloat(formData.wholesale_price) * 0.8, // Estimación del costo
      public_price: Number.parseFloat(formData.public_price),
      wholesale_price: Number.parseFloat(formData.wholesale_price),
      category: formData.category,
      brand: formData.brand,
      stock_quantity: formData.has_variants ? 0 : Number.parseInt(formData.stock_quantity),
      min_stock: Number.parseInt(formData.min_stock),
      has_variants: formData.has_variants,
      is_active: true, // New products are active by default
    }

    try {
      if (editingProduct) {
        const { error } = await supabase.from("products").update(productData).eq("id", editingProduct.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from("products").insert([productData])

        if (error) throw error
      }

      await fetchProducts()
      resetForm()
      setIsDialogOpen(false)
    } catch (error) {
      console.error("Error saving product:", error)
    }
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      description: product.description || "",
      barcode: product.barcode || "",
      sku: product.sku || "",
      public_price: product.public_price?.toString() || product.price?.toString() || "",
      wholesale_price: product.wholesale_price?.toString() || "",
      category: product.category || "",
      brand: product.brand || "",
      stock_quantity: product.stock_quantity.toString(),
      min_stock: product.min_stock.toString(),
      has_variants: product.has_variants || false,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string, productName: string) => {
    try {
      // Always attempt to deactivate the product
      const { error: deactivateError } = await supabase.from("products").update({ is_active: false }).eq("id", id)

      if (deactivateError) {
        throw deactivateError
      }

      await fetchProducts()
      alert(`Producto "${productName}" ha sido desactivado.`)
    } catch (error) {
      console.error("Error deactivating product:", error)
      alert(
        `Error al desactivar el producto "${productName}": ${error instanceof Error ? error.message : "Error desconocido"}`,
      )
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      barcode: "",
      sku: "",
      public_price: "",
      wholesale_price: "",
      category: "",
      brand: "",
      stock_quantity: "",
      min_stock: "",
      has_variants: false,
    })
    setEditingProduct(null)
    setIsAddingNewCategory(false)
    setNewCategoryName("")
  }

  const handleManageVariants = async (product: Product) => {
    setSelectedProductForVariants(product)

    // Cargar variantes del producto
    try {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", product.id)
        .order("name")

      if (error) throw error
      setVariants(data || [])
      setIsVariantsDialogOpen(true)
    } catch (error) {
      console.error("Error fetching variants:", error)
    }
  }

  const handleAddVariant = async () => {
    if (!selectedProductForVariants || !newVariant.name) return

    try {
      const variantData = {
        product_id: selectedProductForVariants.id,
        name: newVariant.name,
        sku: newVariant.sku || null,
        barcode: newVariant.barcode || null,
        public_price: Number.parseFloat(newVariant.public_price),
        wholesale_price: Number.parseFloat(newVariant.wholesale_price),
        stock_quantity: Number.parseInt(newVariant.stock_quantity),
        min_stock: Number.parseInt(newVariant.min_stock),
        is_active: true, // New variants are active by default
      }

      const { error } = await supabase.from("product_variants").insert([variantData])

      if (error) throw error

      // Recargar variantes
      const { data } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", selectedProductForVariants.id)
        .order("name")

      setVariants(data || [])

      // Limpiar formulario de nueva variante
      setNewVariant({
        name: "",
        sku: "",
        barcode: "",
        public_price: "",
        wholesale_price: "",
        stock_quantity: "",
        min_stock: "",
      })

      // Actualizar productos
      await fetchProducts()
    } catch (error) {
      console.error("Error adding variant:", error)
    }
  }

  const handleDeleteVariant = async (variantId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta variante?")) return

    try {
      const { error } = await supabase.from("product_variants").delete().eq("id", variantId)

      if (error) throw error

      // Recargar variantes
      const { data } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", selectedProductForVariants!.id)
        .order("name")

      setVariants(data || [])
      await fetchProducts()
    } catch (error) {
      console.error("Error deleting variant:", error)
    }
  }

  const clearFilters = () => {
    setSearchTerm("")
    setSelectedCategory("all")
    setBrand("all")
  }

  const filteredProducts = products.filter((product) => {
    // Only show active products by default
    if (product.is_active === false) return false

    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesCategory = !selectedCategory || selectedCategory === "all" || product.category === selectedCategory
    const matchesBrand = !selectedBrand || selectedBrand === "all" || product.brand === selectedBrand

    return matchesSearch && matchesCategory && matchesBrand
  })

  const lowStockProducts = products.filter((product) => {
    if (product.is_active === false) return false // Only consider active products for low stock alert
    if (product.has_variants) {
      return product.variants?.some((variant) => variant.stock_quantity <= variant.min_stock)
    }
    return product.stock_quantity <= product.min_stock
  })

  if (loading) {
    return <div className="flex justify-center items-center h-64">Cargando productos...</div>
  }

  return (
    <div className="space-y-10 p-6 lg:p-12 bg-[#f8fafc] min-h-full transition-all duration-500 animate-in fade-in slide-in-from-bottom-4">
      {/* Título de la página */}
      <div className="mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h1 className="text-7xl font-black text-slate-900 tracking-tighter leading-none mb-4">
            Productos<span className="text-[#10b981]">.</span>
          </h1>
          <p className="text-xl font-bold text-slate-400 max-w-2xl">
            Gestiona tu catálogo maestro, controla inventarios y organiza variantes de productos en un solo lugar.
          </p>
        </div>
        <div className="hidden lg:flex gap-4">
          <div className="p-6 bg-white rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Catálogo</p>
              <p className="text-2xl font-black text-slate-900 leading-none">{products.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de stock bajo */}
      {lowStockProducts.length > 0 && (
        <Alert className="border-none bg-rose-50 rounded-[32px] p-8 shadow-sm">
          <div className="flex items-start gap-6">
            <div className="p-4 bg-white rounded-2xl shadow-sm">
              <AlertTriangle className="h-8 w-8 text-rose-500" />
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-black text-rose-900 uppercase tracking-tight mb-2">Alerta de Inventario</h4>
              <p className="text-rose-700 font-bold mb-4 opacity-80">
                Tienes {lowStockProducts.length} productos que requieren atención inmediata por stock crítico.
              </p>
              <div className="flex flex-wrap gap-2">
                {lowStockProducts.slice(0, 5).map((product) => (
                  <Badge key={product.id} variant="outline" className="bg-white/50 border-rose-200 text-rose-700 font-black px-4 py-1.5 rounded-xl">
                    {product.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Alert>
      )}

      {/* Contenedor de Filtros */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch lg:items-center bg-white p-8 rounded-[40px] shadow-sm border border-slate-50">
        <div className="relative flex-1">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 h-6 w-6" />
          <Input
            placeholder="Buscar por nombre, SKU o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-16 h-16 bg-slate-50 border-none rounded-[24px] text-lg font-bold placeholder:text-slate-300 focus-visible:ring-2 focus-visible:ring-emerald-500/10 w-full"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Select value={selectedCategory || "all"} onValueChange={(v) => setSelectedCategory(v === "all" ? "" : v)}>
            <SelectTrigger className="w-full sm:w-64 h-16 bg-slate-50 border-none rounded-[24px] font-bold text-slate-600 px-6">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent className="rounded-3xl border-none shadow-2xl p-2">
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToCSV} className="h-16 rounded-[24px] border-none bg-emerald-50 text-emerald-600 font-bold hover:bg-emerald-100 px-6 transition-all">
              <Download className="h-6 w-6 sm:mr-2" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(true)} className="h-16 rounded-[24px] border-none bg-slate-50 text-slate-500 font-bold hover:bg-slate-100 px-6 transition-all">
              <Upload className="h-6 w-6 sm:mr-2" />
              <span className="hidden sm:inline">Importar</span>
            </Button>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="h-16 rounded-[28px] bg-[#10b981] hover:bg-[#059669] text-white font-black text-lg uppercase tracking-[0.2em] shadow-xl shadow-emerald-200 px-10 transition-all active:scale-95">
                <Plus className="h-6 w-6 mr-2" />
                Nuevo Producto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl rounded-[44px] border-none shadow-2xl p-10 max-h-[90vh] overflow-y-auto">
              <DialogHeader className="mb-8">
                <DialogTitle className="text-5xl font-black text-slate-900 tracking-tighter">
                  {editingProduct ? "Editar" : "Nuevo"} <span className="text-emerald-500">Producto.</span>
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Nombre Comercial *</Label>
                    <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="h-14 bg-slate-50 border-none rounded-2xl text-lg font-bold" required />
                  </div>
                  <div className="space-y-3">
                    <Label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">SKU / Referencia</Label>
                    <Input value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} className="h-14 bg-slate-50 border-none rounded-2xl text-lg font-bold uppercase" />
                  </div>
                  <div className="space-y-3">
                    <Label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Código de Barras</Label>
                    <Input value={formData.barcode} onChange={(e) => setFormData({...formData, barcode: e.target.value})} className="h-14 bg-slate-50 border-none rounded-2xl font-mono text-lg" />
                  </div>
                  <div className="space-y-3">
                    <Label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Marca</Label>
                    <Input value={formData.brand} onChange={(e) => setFormData({...formData, brand: e.target.value})} className="h-14 bg-slate-50 border-none rounded-2xl text-lg font-bold" />
                  </div>
                  <div className="space-y-3">
                    <Label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Categoría</Label>
                    {!isAddingNewCategory ? (
                      <Select value={formData.category} onValueChange={(v) => v === "add_new" ? setIsAddingNewCategory(true) : setFormData({...formData, category: v})}>
                        <SelectTrigger className="h-14 bg-slate-50 border-none rounded-2xl font-bold px-6">
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-xl">
                          {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          <SelectItem value="add_new" className="text-emerald-600 font-black">+ NUEVA...</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex gap-2">
                         <Input placeholder="Nueva categoría..." value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="h-14 bg-slate-50 border-none rounded-2xl font-bold" />
                         <Button type="button" onClick={handleAddNewCategory} className="h-14 w-14 rounded-2xl bg-emerald-500"><Plus className="h-6 w-6" /></Button>
                         <Button type="button" variant="ghost" onClick={() => setIsAddingNewCategory(false)} className="h-14 w-14 rounded-2xl text-rose-500"><XCircle className="h-6 w-6" /></Button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Precio Venta *</Label>
                      <Input type="number" step="0.01" value={formData.public_price} onChange={(e) => setFormData({...formData, public_price: e.target.value})} className="h-14 bg-slate-50 border-none rounded-2xl text-xl font-black text-emerald-600" required />
                    </div>
                    <div className="space-y-3">
                      <Label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Precio Costo *</Label>
                      <Input type="number" step="0.01" value={formData.wholesale_price} onChange={(e) => setFormData({...formData, wholesale_price: e.target.value})} className="h-14 bg-slate-50 border-none rounded-2xl text-xl font-black text-blue-600" required />
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-slate-50 rounded-[32px] space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Gestión por Variantes</h4>
                      <p className="text-sm text-slate-400 font-medium">Habilitar múltiples presentaciones (talla, color, etc.)</p>
                    </div>
                    <Switch checked={formData.has_variants} onCheckedChange={(v) => setFormData({...formData, has_variants: v})} className="scale-125 data-[state=checked]:bg-emerald-500" />
                  </div>
                  {!formData.has_variants && (
                    <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Stock Actual</Label><Input type="number" value={formData.stock_quantity} onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})} className="h-14 bg-white border-none rounded-2xl text-lg font-black" required /></div>
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Mínimo Crítico</Label><Input type="number" value={formData.min_stock} onChange={(e) => setFormData({...formData, min_stock: e.target.value})} className="h-14 bg-white border-none rounded-2xl text-lg font-black" required /></div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Descripción Destacada</Label>
                  <Textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="bg-slate-50 border-none rounded-3xl p-6 text-base font-medium resize-none min-h-[120px]" />
                </div>

                <div className="flex justify-end gap-4 pt-6"><Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-16 px-10 rounded-3xl font-black uppercase tracking-widest text-slate-400">Descartar</Button><Button type="submit" className="h-16 px-12 rounded-3xl bg-slate-900 hover:bg-black text-white font-black uppercase tracking-widest shadow-xl transition-all active:scale-95">{editingProduct ? "Actualizar" : "Registrar"} Producto</Button></div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">
        <span>Catálogo Maestro de Inventario</span>
        <span>Resultados: {filteredProducts.length} Ítems</span>
      </div>

      {/* Tabla de productos (Rediseñada) */}
      <Card className="border-none shadow-sm rounded-[44px] overflow-hidden bg-white p-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-50 hover:bg-transparent">
                  <TableHead className="h-16 px-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Producto</TableHead>
                  <TableHead className="h-16 hidden sm:table-cell text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Referencia / Marca</TableHead>
                  <TableHead className="h-16 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">P. Venta</TableHead>
                  <TableHead className="h-16 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Stock</TableHead>
                  <TableHead className="h-16 text-right px-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id} className="group border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <TableCell className="px-8 py-8">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black text-slate-900 group-hover:text-emerald-500 transition-colors">{product.name}</span>
                        {product.has_variants && <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[10px] px-2 py-0.5 rounded-lg">VARIANTES</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell py-8 font-mono text-sm font-black text-slate-400 uppercase">{product.sku || "S/SKU"} • {product.brand || "GENÉRICO"}</TableCell>
                    <TableCell className="py-8"><span className="text-2xl font-black text-slate-900 tracking-tighter italic">${(product.public_price || 0).toFixed(2)}</span></TableCell>
                    <TableCell className="py-8">
                      <div className={cn(
                        "inline-flex flex-col items-center justify-center min-w-[72px] h-[72px] rounded-[24px]",
                        (product.has_variants ? product.variants?.some(v => v.stock_quantity <= v.min_stock) : product.stock_quantity <= product.min_stock) ? "bg-rose-50 text-rose-600 shadow-sm" : "bg-emerald-50 text-emerald-600"
                      )}>
                        <span className="text-2xl font-black">{product.has_variants ? product.variants?.reduce((s, v) => s + v.stock_quantity, 0) : product.stock_quantity}</span>
                        <span className="text-[9px] font-black uppercase opacity-60">uds</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-8 py-8">
                      <div className="flex justify-end gap-3 text-slate-300">
                        {product.has_variants && <Button variant="ghost" size="icon" onClick={() => handleManageVariants(product)} className="h-12 w-12 rounded-2xl hover:bg-white hover:text-emerald-500 hover:shadow-sm"><Settings className="h-6 w-6" /></Button>}
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(product)} className="h-12 w-12 rounded-2xl hover:bg-white hover:text-blue-500 hover:shadow-sm"><Edit className="h-6 w-6" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id, product.name)} className="h-12 w-12 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-colors"><Trash2 className="h-6 w-6" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de Importación */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-2xl rounded-[40px] border-none shadow-2xl p-10">
          <DialogHeader className="mb-8">
            <DialogTitle className="text-4xl font-black text-slate-900 tracking-tighter">Carga <span className="text-blue-500">Masiva.</span></DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-black text-slate-900">Plantilla Oficial</h4>
                <p className="text-sm text-slate-400 font-medium">Usa este formato para evitar errores de carga.</p>
              </div>
              <Button onClick={downloadTemplate} className="h-14 rounded-2xl bg-white border-none shadow-sm font-black text-xs uppercase tracking-widest px-8">Descargar</Button>
            </div>

            <div className="space-y-3">
              <Label className="ml-1 text-[11px] font-black uppercase tracking-widest text-slate-400">Archivo CSV</Label>
              <Input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="h-20 bg-slate-50 border-none rounded-[24px] text-sm font-bold file:h-12 file:bg-emerald-500 file:text-white file:border-none file:rounded-xl file:px-6 file:mr-6 file:font-black file:uppercase file:text-[10px] file:tracking-widest"
              />
            </div>

            {isImporting && (
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <span>Procesando Datos...</span>
                  <span>{Math.round(importProgress)}%</span>
                </div>
                <Progress value={importProgress} className="h-3 bg-slate-100 rounded-full" />
              </div>
            )}

            {importResult && (
              <Alert className={cn("rounded-3xl border-none p-6 shadow-sm", importResult.errors.length > 0 ? "bg-rose-50" : "bg-emerald-50")}>
                <div className="flex gap-4">
                  {importResult.errors.length > 0 ? <XCircle className="h-6 w-6 text-rose-500" /> : <CheckCircle className="h-6 w-6 text-emerald-500" />}
                  <div className="text-sm font-bold">
                    {importResult.success > 0 && <p className="text-emerald-700">✓ {importResult.success} productos importados con éxito.</p>}
                    {importResult.errors.length > 0 && (
                      <div className="text-rose-700 mt-2">
                        <p className="mb-2">Se detectaron {importResult.errors.length} problemas:</p>
                        <ul className="list-disc list-inside space-y-1 opacity-70 max-h-40 overflow-y-auto">
                          {importResult.errors.map((error, i) => <li key={i}>{error}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </Alert>
            )}

            <div className="flex justify-end gap-3 pt-6"><Button variant="ghost" onClick={() => setIsImportDialogOpen(false)} className="h-14 rounded-2xl font-black uppercase tracking-widest text-slate-400">Cancelar</Button><Button onClick={importCSV} disabled={!importFile || isImporting} className="h-14 px-10 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest">Cruzar Datos</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Variantes */}
      <Dialog open={isVariantsDialogOpen} onOpenChange={setIsVariantsDialogOpen}>
        <DialogContent className="max-w-4xl rounded-[44px] border-none shadow-2xl p-10 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="mb-6"><DialogTitle className="text-4xl font-black">Variantes : {selectedProductForVariants?.name}.</DialogTitle></DialogHeader>
          <Tabs defaultValue="list" className="space-y-8">
            <TabsList className="bg-slate-100 p-1.5 rounded-2xl h-16 w-full">
              <TabsTrigger value="list" className="flex-1 rounded-xl font-black text-sm uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Listado Maestro</TabsTrigger>
              <TabsTrigger value="add" className="flex-1 rounded-xl font-black text-sm uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Nueva Variante</TabsTrigger>
            </TabsList>
            <TabsContent value="list" className="pt-4">
              <Table>
                <TableHeader><TableRow className="border-slate-100 hover:bg-transparent"><TableHead className="font-black text-[11px] uppercase tracking-widest">Atributo / Variante</TableHead><TableHead className="font-black text-[11px] uppercase tracking-widest">Stock</TableHead><TableHead className="text-right font-black text-[11px] uppercase tracking-widest">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>
                  {variants.map(v => (
                    <TableRow key={v.id} className="border-slate-50">
                      <TableCell className="py-6 font-black text-slate-800 text-lg">{v.name}</TableCell>
                      <TableCell className="py-6"><Badge variant={v.stock_quantity <= v.min_stock ? "destructive" : "secondary"} className="h-10 px-4 rounded-xl font-black text-base">{v.stock_quantity}</Badge></TableCell>
                      <TableCell className="py-6 text-right"><Button variant="ghost" size="icon" onClick={() => handleDeleteVariant(v.id)} className="h-12 w-12 rounded-2xl text-rose-500 hover:bg-rose-50"><Trash2 className="h-5 w-5" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="add" className="space-y-8 pt-4">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3"><Label className="ml-1 text-[11px] font-black uppercase text-slate-400">Identificador</Label><Input value={newVariant.name} onChange={(e) => setNewVariant({...newVariant, name: e.target.value})} className="h-14 bg-slate-50 border-none rounded-2xl text-lg font-bold" placeholder="Ej: Verde / XL" /></div>
                <div className="space-y-3"><Label className="ml-1 text-[11px] font-black uppercase text-slate-400">Stock Inicial</Label><Input type="number" value={newVariant.stock_quantity} onChange={(e) => setNewVariant({...newVariant, stock_quantity: e.target.value})} className="h-14 bg-slate-50 border-none rounded-2xl text-xl font-black" /></div>
              </div>
              <Button onClick={handleAddVariant} className="w-full h-16 rounded-[24px] bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest text-lg shadow-xl shadow-emerald-100 transition-all active:scale-95">Inyectar Variante</Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
