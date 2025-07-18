"use client"

import { useState, useRef, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Camera, Search, XCircle, Package } from "lucide-react"
import { BarcodeDetector } from "barcode-detector"

interface Product {
  id: string
  name: string
  sku: string
  price: number
  stock_quantity: number
  category: string
  brand?: string
}

interface ScanResult {
  code: string
  product: Product | null
  timestamp: string
}

export default function BarcodeScanner() {
  const [isScanning, setIsScanning] = useState(false)
  const [manualCode, setManualCode] = useState("")
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<any>(null)
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Inicializar detector de códigos de barras
  useEffect(() => {
    const initBarcodeDetector = async () => {
      try {
        // Verificar si BarcodeDetector está disponible
        if ("BarcodeDetector" in window) {
          // @ts-ignore
          detectorRef.current = new BarcodeDetector({
            formats: [
              "code_128",
              "code_39",
              "code_93",
              "ean_13",
              "ean_8",
              "upc_a",
              "upc_e",
              "itf", // Interleaved 2 of 5
              "qr_code",
              "data_matrix",
              "pdf417",
            ],
          })
          console.log("BarcodeDetector initialized successfully")
        } else {
          console.log("BarcodeDetector not supported, using fallback")
        }
      } catch (error) {
        console.error("Error initializing BarcodeDetector:", error)
      }
    }

    initBarcodeDetector()
  }, [])

  const startCamera = async () => {
    try {
      setError(null)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Usar cámara trasera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setIsScanning(true)

        // Iniciar detección automática
        startBarcodeDetection()
      }
    } catch (error) {
      console.error("Error accessing camera:", error)
      setError("No se pudo acceder a la cámara. Verifica los permisos.")
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }

    setIsScanning(false)
  }

  const startBarcodeDetection = () => {
    if (!detectorRef.current || !videoRef.current) {
      console.log("Detector or video not available")
      return
    }

    scanIntervalRef.current = setInterval(async () => {
      try {
        if (videoRef.current && videoRef.current.readyState === 4) {
          const barcodes = await detectorRef.current.detect(videoRef.current)

          if (barcodes.length > 0) {
            const barcode = barcodes[0]
            console.log("Barcode detected:", barcode.rawValue, "Format:", barcode.format)

            // Detener la cámara y buscar el producto
            stopCamera()
            await searchProduct(barcode.rawValue)
          }
        }
      } catch (error) {
        console.error("Error detecting barcode:", error)
      }
    }, 500) // Escanear cada 500ms
  }

  const searchProduct = async (code: string) => {
    setLoading(true)
    setError(null)

    try {
      console.log("Searching for product with code:", code)

      // Buscar producto por SKU
      const { data: product, error: searchError } = await supabase.from("products").select("*").eq("sku", code).single()

      if (searchError && searchError.code !== "PGRST116") {
        throw searchError
      }

      const result: ScanResult = {
        code,
        product: product || null,
        timestamp: new Date().toISOString(),
      }

      setScanResult(result)

      if (!product) {
        setError(`No se encontró ningún producto con el código: ${code}`)
      }
    } catch (error) {
      console.error("Error searching product:", error)
      setError("Error al buscar el producto")
    } finally {
      setLoading(false)
    }
  }

  const handleManualSearch = async () => {
    if (!manualCode.trim()) return
    await searchProduct(manualCode.trim())
  }

  const handleTestCode = async () => {
    await searchProduct("0123456783")
  }

  const resetScan = () => {
    setScanResult(null)
    setError(null)
    setManualCode("")
  }

  return (
    <div className="space-y-6">
      {/* Búsqueda Manual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Búsqueda Manual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">Ingresa el código de barras manualmente</p>

          <div className="flex gap-2">
            <Input
              placeholder="Escanea o ingresa el código de barras"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleManualSearch()}
            />
            <Button onClick={handleManualSearch} disabled={loading || !manualCode.trim()}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Escáner con Cámara */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Escáner con Cámara
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">Usa la cámara para escanear códigos de barras</p>

          {/* Video para la cámara */}
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-w-md mx-auto rounded-lg bg-black"
              style={{ display: isScanning ? "block" : "none" }}
            />

            {/* Overlay de targeting */}
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-red-500 w-64 h-32 rounded-lg"></div>
              </div>
            )}
          </div>

          {/* Controles */}
          <div className="flex gap-2 justify-center">
            {!isScanning ? (
              <Button onClick={startCamera} className="bg-green-600 hover:bg-green-700">
                <Camera className="h-4 w-4 mr-2" />
                Iniciar Escáner
              </Button>
            ) : (
              <Button onClick={stopCamera} variant="outline">
                <XCircle className="h-4 w-4 mr-2" />
                Detener
              </Button>
            )}

            <Button onClick={handleTestCode} variant="outline">
              Probar Código
            </Button>
          </div>

          <p className="text-xs text-center text-gray-500">
            Apunta la cámara hacia el código de barras. Soporta códigos entrelazados 2 de 5.
          </p>
        </CardContent>
      </Card>

      {/* Resultado del escaneo */}
      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Buscando producto...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <Package className="h-4 w-4 text-red-600" />
          <AlertDescription>
            <strong>Producto No Encontrado</strong>
            <p className="mt-1">{error}</p>
          </AlertDescription>
        </Alert>
      )}

      {scanResult && scanResult.product && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Package className="h-5 w-5" />
              Producto Encontrado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Nombre</p>
                <p className="font-medium">{scanResult.product.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">SKU</p>
                <p className="font-mono text-sm">{scanResult.product.sku}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Precio</p>
                <p className="font-medium text-green-600">${scanResult.product.price.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Stock</p>
                <Badge variant={scanResult.product.stock_quantity > 0 ? "default" : "destructive"}>
                  {scanResult.product.stock_quantity} unidades
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600">Categoría</p>
                <Badge variant="outline">{scanResult.product.category}</Badge>
              </div>
              {scanResult.product.brand && (
                <div>
                  <p className="text-sm text-gray-600">Marca</p>
                  <p className="font-medium">{scanResult.product.brand}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={resetScan} variant="outline">
                Escanear Otro
              </Button>
              <Button onClick={() => startCamera()} className="bg-blue-600 hover:bg-blue-700">
                <Camera className="h-4 w-4 mr-2" />
                Escanear de Nuevo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
