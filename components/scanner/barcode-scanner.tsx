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
import { cn } from "@/lib/utils"

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

  useEffect(() => {
    const initBarcodeDetector = async () => {
      try {
        if ("BarcodeDetector" in window) {
          // @ts-ignore
          detectorRef.current = new BarcodeDetector({
            formats: ["code_128", "code_39", "code_93", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "qr_code", "data_matrix", "pdf417"],
          })
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
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setIsScanning(true)
        startBarcodeDetection()
      }
    } catch (error) {
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
    if (!detectorRef.current || !videoRef.current) return

    scanIntervalRef.current = setInterval(async () => {
      try {
        if (videoRef.current && videoRef.current.readyState === 4) {
          const barcodes = await detectorRef.current.detect(videoRef.current)
          if (barcodes.length > 0) {
            stopCamera()
            await searchProduct(barcodes[0].rawValue)
          }
        }
      } catch (error) {
        console.error("Detection error:", error)
      }
    }, 500)
  }

  const searchProduct = async (code: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data: product, error: searchError } = await supabase.from("products").select("*").eq("sku", code).single()
      if (searchError && searchError.code !== "PGRST116") throw searchError

      const result: ScanResult = {
        code,
        product: product || null,
        timestamp: new Date().toISOString(),
      }
      setScanResult(result)
      if (!product) setError(`No se encontró el código: ${code}`)
    } catch (error) {
      setError("Error al buscar el producto")
    } finally {
      setLoading(false)
    }
  }

  const handleManualSearch = async () => {
    if (!manualCode.trim()) return
    await searchProduct(manualCode.trim())
  }

  const resetScan = () => {
    setScanResult(null)
    setError(null)
    setManualCode("")
  }

  return (
    <div className="space-y-12 max-w-[1200px] mx-auto p-6 md:p-10 animate-in fade-in duration-700">
      {/* Massive Big UI Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-4">
        <div>
          <h1 className="text-7xl md:text-8xl font-black tracking-tighter text-slate-900 leading-[0.8] mb-4">
            Scanner<span className="text-emerald-500">.</span>
          </h1>
          <p className="text-xl font-bold text-slate-400 uppercase tracking-widest italic ml-1">
            Detección inteligente de inventario
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
        {/* Camera/Input Side */}
        <div className="space-y-10">
          {/* Manual Search Section */}
          <Card className="rounded-[44px] border-none shadow-sm bg-white p-8 space-y-6 border border-slate-50">
            <div className="flex items-center gap-3 ml-1">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                <Search className="h-5 w-5" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Ingreso Manual</p>
            </div>
            
            <div className="flex gap-4">
              <Input
                placeholder="ESCRIBE O PEGA EL CÓDIGO..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleManualSearch()}
                className="h-20 px-8 rounded-[24px] border-none bg-slate-50 shadow-sm font-black text-xl uppercase tracking-widest placeholder:text-slate-200 focus-visible:ring-4 focus-visible:ring-emerald-500/10 transition-all text-slate-900"
              />
              <Button 
                onClick={handleManualSearch} 
                className="h-20 w-20 rounded-[24px] bg-slate-900 hover:bg-emerald-500 text-white transition-all active:scale-95"
                disabled={loading || !manualCode.trim()}
              >
                <Search className="h-6 w-6" />
              </Button>
            </div>
          </Card>

          {/* Camera Section */}
          <Card className="rounded-[44px] border-none shadow-sm bg-white overflow-hidden relative group transition-all duration-700 hover:shadow-2xl border border-slate-50">
            <div className="aspect-[4/3] relative flex items-center justify-center bg-slate-100">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn("w-full h-full object-cover transition-opacity duration-1000", isScanning ? "opacity-100" : "opacity-30")}
              />

              {/* Glassmorphic Overlay (Light Mode) */}
              {isScanning && (
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden z-10">
                  <div className="absolute inset-0 bg-white/30 backdrop-blur-[1px]"></div>
                  <div className="relative w-64 h-64 border-4 border-emerald-500/30 rounded-[44px] bg-white/10 backdrop-blur-md flex items-center justify-center animate-pulse">
                     {/* Corner Brackets */}
                     <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-emerald-500 rounded-tl-3xl shadow-[0_0_15px_rgba(16,185,129,0.3)]"></div>
                     <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-emerald-500 rounded-tr-3xl shadow-[0_0_15px_rgba(16,185,129,0.3)]"></div>
                     <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-emerald-500 rounded-bl-3xl shadow-[0_0_15px_rgba(16,185,129,0.3)]"></div>
                     <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-emerald-500 rounded-br-3xl shadow-[0_0_15px_rgba(16,185,129,0.3)]"></div>
                     
                     {/* Scanning Laser */}
                     <div className="absolute w-[85%] h-[4px] bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.8)] top-1/2 -translate-y-1/2 animate-[rebound_2s_infinite_ease-in-out]"></div>
                  </div>
                </div>
              )}

              {/* Not Scanning Visual */}
              {!isScanning && !loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-6">
                  <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center shadow-inner">
                    <Camera className="h-10 w-10" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-400">SISTEMA DE VISIÓN</p>
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic font-mono">EN ESPERA DE ACTIVACIÓN</p>
                  </div>
                </div>
              )}

              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-xl z-20 gap-8">
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-slate-50 border-t-emerald-500 rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center animate-pulse">
                        <Search className="h-5 w-5 text-emerald-500" />
                      </div>
                    </div>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-[12px] font-black text-emerald-600 uppercase tracking-[0.3em]">ANALIZANDO SKU</p>
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest italic animate-pulse">CONECTANDO CON EL SERVIDOR...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Camera Controls */}
            <div className="p-10 bg-white flex justify-center gap-6 border-t border-slate-50">
              {!isScanning ? (
                <Button 
                  onClick={startCamera} 
                  className="h-20 px-12 rounded-[28px] bg-emerald-500 hover:bg-emerald-600 font-black uppercase tracking-widest text-[12px] shadow-2xl shadow-emerald-500/20 active:scale-95 transition-all text-white border-0"
                >
                  <Camera className="h-6 w-6 mr-3" />
                  Iniciar Escaneo Pro
                </Button>
              ) : (
                <Button 
                  onClick={stopCamera} 
                  className="h-20 px-12 rounded-[28px] bg-rose-500 hover:bg-rose-600 font-black uppercase tracking-widest text-[12px] shadow-2xl shadow-rose-500/20 active:scale-95 transition-all text-white border-0"
                >
                  <XCircle className="h-6 w-6 mr-3" />
                  Apagar Cámara
                </Button>
              )}
              <Button 
                onClick={() => searchProduct("0123456783")} 
                variant="ghost" 
                className="h-20 px-10 rounded-[28px] border-2 border-slate-100 text-slate-400 hover:text-slate-900 hover:bg-slate-50 font-black uppercase tracking-widest text-[11px] transition-all"
              >
                Prueba Local
              </Button>
            </div>
          </Card>
        </div>

        {/* Result Side */}
        <div className="space-y-10 min-h-64 flex flex-col items-center justify-center relative">
          {error && (
            <div className="w-full animate-in slide-in-from-right-10 duration-500">
              <Alert className="rounded-[44px] border-none bg-rose-50 p-10 flex gap-6 items-start">
                <div className="w-16 h-16 rounded-2xl bg-rose-500 flex items-center justify-center text-white shadow-xl shadow-rose-500/20 shrink-0">
                  <XCircle className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-rose-300 uppercase tracking-[0.2em] mb-1">DETECCIÓN FALLIDA</p>
                  <h3 className="text-3xl font-black text-rose-600 tracking-tighter leading-tight italic uppercase">{error}</h3>
                  <p className="text-sm font-bold text-rose-400 uppercase tracking-tight italic pt-2">Verifica el código o ingresalo manualmente</p>
                </div>
              </Alert>
            </div>
          )}

          {scanResult && scanResult.product ? (
            <div className="w-full space-y-8 animate-in zoom-in-95 fade-in duration-500">
              <Card className="rounded-[44px] border-none shadow-sm bg-white p-12 space-y-10 border border-slate-50 relative overflow-hidden group">
                {/* Product Header */}
                <div className="space-y-4">
                  <Badge className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest mb-4">DETECCIÓN POSITIVA</Badge>
                  <h2 className="text-6xl md:text-7xl font-black text-slate-900 tracking-tighter leading-[0.85] italic uppercase group-hover:text-emerald-500 transition-colors duration-500">
                    {scanResult.product.name}
                  </h2>
                  <p className="text-xl font-bold text-slate-400 uppercase tracking-tighter italic font-mono">{scanResult.product.sku}</p>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-6">
                  <div className="bg-slate-50 p-8 rounded-[32px] space-y-2 group/card hover:bg-emerald-500 transition-all duration-500">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] group-hover/card:text-emerald-200">PRECIO ACTUAL</p>
                    <p className="text-4xl font-black text-slate-900 tracking-tighter italic group-hover/card:text-white transition-colors">
                      ${scanResult.product.price.toFixed(2)}
                    </p>
                  </div>
                  <div className={cn(
                    "p-8 rounded-[32px] space-y-2 transition-all duration-500",
                    scanResult.product.stock_quantity > 0 ? "bg-emerald-50 group/card border border-emerald-100/50" : "bg-rose-50 border border-rose-100/50"
                  )}>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">STOCK DISPONIBLE</p>
                    <p className={cn(
                      "text-4xl font-black tracking-tighter italic",
                      scanResult.product.stock_quantity > 0 ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {scanResult.product.stock_quantity} <span className="text-sm uppercase tracking-widest ml-1 opacity-50 font-black">UNDS</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 pt-6">
                  <div className="flex-1 bg-slate-50 rounded-2xl p-6 flex flex-col gap-1 items-start justify-center">
                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">CATEGORÍA</p>
                    <p className="font-black text-slate-900 uppercase tracking-tighter italic">{scanResult.product.category}</p>
                  </div>
                  {scanResult.product.brand && (
                    <div className="flex-1 bg-slate-50 rounded-2xl p-6 flex flex-col gap-1 items-start justify-center">
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">MARCA</p>
                      <p className="font-black text-slate-900 uppercase tracking-tighter italic">{scanResult.product.brand}</p>
                    </div>
                  )}
                </div>

                {/* Scan Action Buttons */}
                <div className="flex gap-4 pt-4">
                  <Button 
                    onClick={resetScan} 
                    variant="outline" 
                    className="flex-1 h-16 rounded-[20px] border-slate-200 font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
                  >
                    Cerrar Resultado
                  </Button>
                  <Button 
                    onClick={() => startCamera()} 
                    className="flex-1 h-16 rounded-[20px] bg-slate-900 border-none hover:bg-emerald-500 text-white font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-slate-900/10"
                  >
                    Escanear Nuevo
                  </Button>
                </div>
              </Card>
            </div>
          ) : !error && (
            <div className="text-center space-y-10 animate-in fade-in duration-1000 max-w-sm">
              <div className="w-40 h-40 bg-slate-50 rounded-[48px] flex items-center justify-center text-slate-200 mx-auto relative group shadow-inner">
                <Package className="h-20 w-20 group-hover:scale-110 group-hover:text-emerald-500 transition-all duration-700" />
                <div className="absolute inset-0 border-4 border-dashed border-slate-100 rounded-[48px] animate-[spin_30s_linear_infinite]"></div>
              </div>
              <div className="space-y-4">
                <h3 className="text-3xl font-black text-slate-300 tracking-tighter italic uppercase leading-tight">Sistema en Espera</h3>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] max-w-[240px] mx-auto leading-relaxed italic">Inicie el escáner o realice una búsqueda manual para identificar productos</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes rebound {
          0%, 100% { top: 10%; }
          50% { top: 90%; }
        }
      `}</style>
    </div>
  )
}
