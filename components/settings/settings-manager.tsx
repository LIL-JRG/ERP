"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Settings, Building, Calculator, AlertCircle, Save } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Setting {
  id: string
  key: string
  value: string
  description: string
  data_type: string
}

export default function SettingsManager() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from("settings").select("*").order("key")

      if (error) throw error

      setSettings(data || [])

      // Convertir a objeto para el formulario
      const formObject: Record<string, any> = {}
      ;(data || []).forEach((setting) => {
        switch (setting.data_type) {
          case "boolean":
            formObject[setting.key] = setting.value === "true"
            break
          case "number":
            formObject[setting.key] = Number.parseFloat(setting.value) || 0
            break
          default:
            formObject[setting.key] = setting.value || ""
        }
      })
      setFormData(formObject)
    } catch (error) {
      console.error("Error fetching settings:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Actualizar cada configuración
      const updates = settings.map((setting) => {
        let value = formData[setting.key]

        // Convertir según el tipo de dato
        switch (setting.data_type) {
          case "boolean":
            value = value ? "true" : "false"
            break
          case "number":
            value = value.toString()
            break
          default:
            value = value.toString()
        }

        return supabase.from("settings").update({ value }).eq("key", setting.key)
      })

      await Promise.all(updates)

      alert("Configuración guardada exitosamente")
    } catch (error) {
      console.error("Error saving settings:", error)
      alert("Error al guardar la configuración")
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (key: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const renderField = (setting: Setting) => {
    const value = formData[setting.key]

    switch (setting.data_type) {
      case "boolean":
        return (
          <div className="flex items-center space-x-2">
            <Switch
              id={setting.key}
              checked={value || false}
              onCheckedChange={(checked) => handleInputChange(setting.key, checked)}
            />
            <Label htmlFor={setting.key}>{setting.description}</Label>
          </div>
        )

      case "number":
        return (
          <div className="space-y-2">
            <Label htmlFor={setting.key}>{setting.description}</Label>
            <Input
              id={setting.key}
              type="number"
              value={value || 0}
              onChange={(e) => handleInputChange(setting.key, Number.parseFloat(e.target.value) || 0)}
              step={setting.key === "tax_rate" ? "0.1" : "1"}
            />
          </div>
        )

      default:
        if (setting.key.includes("address")) {
          return (
            <div className="space-y-2">
              <Label htmlFor={setting.key}>{setting.description}</Label>
              <Textarea
                id={setting.key}
                value={value || ""}
                onChange={(e) => handleInputChange(setting.key, e.target.value)}
                rows={3}
              />
            </div>
          )
        }

        return (
          <div className="space-y-2">
            <Label htmlFor={setting.key}>{setting.description}</Label>
            <Input
              id={setting.key}
              value={value || ""}
              onChange={(e) => handleInputChange(setting.key, e.target.value)}
            />
          </div>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] gap-6 animate-pulse">
        <div className="w-20 h-20 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-2xl font-black text-slate-300 uppercase tracking-tighter italic">Sincronizando Preferencias...</p>
      </div>
    )
  }

  const businessSettings = settings.filter((s) => s.key.startsWith("business_") || s.key.includes("currency"))
  const taxSettings = settings.filter((s) => s.key.startsWith("tax_"))
  const generalSettings = settings.filter(
    (s) => !s.key.startsWith("business_") && !s.key.startsWith("tax_") && !s.key.includes("currency"),
  )

  return (
    <div className="space-y-12 p-6 md:p-10 max-w-[1400px] mx-auto animate-in fade-in duration-700">
      {/* Massive Big UI Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-4">
        <div>
          <h1 className="text-7xl md:text-8xl font-black tracking-tighter text-slate-900 leading-[0.8] mb-4">
            Ajustes<span className="text-emerald-500">.</span>
          </h1>
          <p className="text-xl font-bold text-slate-400 uppercase tracking-widest italic ml-1">
            Configuración Global del Ecosistema
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="h-20 px-10 rounded-[28px] bg-slate-900 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-slate-900/10 transition-all group"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3" />
          ) : (
            <Save className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
          )}
          {saving ? "PROCESANDO..." : "GUARDAR CAMBIOS"}
        </Button>
      </div>

      {/* System Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-[32px] border-none shadow-sm bg-white p-8 group hover:shadow-xl transition-all duration-500">
          <div className="flex justify-between items-start mb-6">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 group-hover:scale-110 transition-transform">
              <Settings className="h-7 w-7" />
            </div>
            <Badge className="bg-emerald-50 text-emerald-600 border-none font-black px-3 py-1 rounded-full uppercase text-[10px] tracking-widest italic">Activo</Badge>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Estado de Red</p>
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Sincronizado</h3>
          </div>
        </Card>

        <Card className="rounded-[32px] border-none shadow-sm bg-white p-8 group hover:shadow-xl transition-all duration-500">
          <div className="flex justify-between items-start mb-6">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <AlertCircle className="h-7 w-7" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Instancia</p>
            <h3 className="text-4xl font-black text-blue-600 tracking-tighter italic">v2.0</h3>
          </div>
        </Card>

        <Card className="rounded-[32px] border-none shadow-sm bg-white p-8 group hover:shadow-xl transition-all duration-500">
          <div className="flex justify-between items-start mb-6">
            <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white group-hover:scale-110 transition-transform">
              <Building className="h-7 w-7" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Parámetros</p>
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter italic">{settings.length} REGISTROS</h3>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="business" className="space-y-8">
        <TabsList className="h-20 p-2 bg-white rounded-[28px] shadow-sm border border-slate-50 gap-2 w-fit">
          <TabsTrigger 
            value="business" 
            className="h-full px-10 rounded-[22px] data-[state=active]:bg-slate-900 data-[state=active]:text-white font-black uppercase tracking-widest text-[10px] transition-all duration-500"
          >
            Corporativo
          </TabsTrigger>
          <TabsTrigger 
            value="taxes" 
            className="h-full px-10 rounded-[22px] data-[state=active]:bg-emerald-500 data-[state=active]:text-white font-black uppercase tracking-widest text-[10px] transition-all duration-500"
          >
            Tributario / Fiscal
          </TabsTrigger>
          <TabsTrigger 
            value="general" 
            className="h-full px-10 rounded-[22px] data-[state=active]:bg-blue-500 data-[state=active]:text-white font-black uppercase tracking-widest text-[10px] transition-all duration-500"
          >
            Preferencias Sistema
          </TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Card className="rounded-[44px] border-none shadow-sm bg-white overflow-hidden p-10 border border-slate-50">
            <div className="flex items-center gap-4 mb-12">
              <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
                <Building className="h-6 w-6" />
              </div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">Identidad de Marca</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {businessSettings.map((setting) => (
                <div key={setting.key} className="space-y-4 group">
                  <div className="flex items-center justify-between ml-1">
                    <Label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                      {setting.description}
                    </Label>
                    <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-slate-100 text-slate-300">
                      {setting.key.toUpperCase()}
                    </Badge>
                  </div>
                  {setting.key.includes("address") ? (
                    <Textarea
                      value={formData[setting.key] || ""}
                      onChange={(e) => handleInputChange(setting.key, e.target.value)}
                      className="rounded-[24px] border-none bg-slate-50 p-6 min-h-[120px] font-bold text-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all"
                    />
                  ) : (
                    <Input
                      value={formData[setting.key] || ""}
                      onChange={(e) => handleInputChange(setting.key, e.target.value)}
                      className="h-16 px-6 rounded-[20px] border-none bg-slate-50 font-black text-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all uppercase tracking-tight"
                    />
                  )}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="taxes" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 rounded-[44px] border-none shadow-sm bg-white p-10 border border-slate-50 h-fit">
              <div className="flex items-center gap-4 mb-12">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                  <Calculator className="h-6 w-6" />
                </div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">Parámetros Fiscales</h3>
              </div>

              <div className="space-y-10">
                {taxSettings.map((setting) => (
                  <div key={setting.key} className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 bg-slate-50/50 rounded-[32px] border border-slate-100 group">
                    <div className="space-y-1">
                      <Label className="text-lg font-black text-slate-900 uppercase tracking-tight italic">{setting.description}</Label>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Control automático de cálculos en documentos fiscales</p>
                    </div>
                    <div className="shrink-0">
                      {setting.data_type === "boolean" ? (
                        <Switch
                          checked={formData[setting.key] || false}
                          onCheckedChange={(checked) => handleInputChange(setting.key, checked)}
                          className="scale-125 data-[state=checked]:bg-emerald-500"
                        />
                      ) : (
                        <div className="relative w-32">
                          <Input
                            type="number"
                            value={formData[setting.key] || 0}
                            onChange={(e) => handleInputChange(setting.key, Number.parseFloat(e.target.value) || 0)}
                            className="h-16 pr-10 text-center rounded-2xl border-none bg-white shadow-sm font-black text-xl text-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-emerald-600 text-lg">%</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="space-y-6 h-fit lg:sticky lg:top-8">
              <Card className="rounded-[40px] border-none shadow-2xl bg-emerald-500 text-white overflow-hidden">
                <div className="p-10 space-y-8">
                  <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-200">Simulador Fiscal</p>
                    <h3 className="text-4xl font-black italic tracking-tighter leading-none whitespace-nowrap">Preview IVA<span className="text-white">.</span></h3>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/20">
                    <div className="flex justify-between items-center opacity-60">
                      <span className="text-xs font-bold uppercase tracking-widest">Base Imponible</span>
                      <span className="text-lg font-black italic tracking-tighter">$1,000.00</span>
                    </div>
                    <div className="flex justify-between items-center text-white/50">
                      <span className="text-xs font-bold uppercase tracking-widest">Desc. Cliente (10%)</span>
                      <span className="text-lg font-black italic tracking-tighter">-$100.00</span>
                    </div>
                    {formData.tax_enabled && (
                      <div className="flex justify-between items-center text-emerald-100">
                        <span className="text-xs font-bold uppercase tracking-widest">IVA ({formData.tax_rate || 0}%)</span>
                        <span className="text-lg font-black italic tracking-tighter">+${(((1000 - 100) * (formData.tax_rate || 0)) / 100).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="pt-8 mt-4 border-t border-white/20">
                      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-100 mb-2">Total Final Estimado</p>
                      <div className="text-5xl font-black italic tracking-tighter text-white leading-none">
                        ${formData.tax_enabled ? (900 + (900 * (formData.tax_rate || 0)) / 100).toFixed(2) : "900.00"}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100 flex items-start gap-4 shadow-sm">
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white shrink-0">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest italic leading-none">Importante</h4>
                  <p className="text-[11px] font-bold text-slate-500 leading-relaxed uppercase tracking-tight">El impuesto se aplica sobre el neto residual tras descuentos.</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="general" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Card className="rounded-[44px] border-none shadow-sm bg-white p-10 border border-slate-50">
            <div className="flex items-center gap-4 mb-12">
              <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <Settings className="h-6 w-6" />
              </div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">Preferencias Operativas</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {generalSettings.map((setting) => (
                <div key={setting.key} className="space-y-4 group p-8 bg-slate-50/50 rounded-[32px] border border-slate-100">
                  <div className="flex items-center justify-between ml-1">
                    <Label className="text-lg font-black text-slate-900 uppercase tracking-tight italic group-focus-within:text-blue-500 transition-colors">
                      {setting.description}
                    </Label>
                    <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-slate-200 text-slate-400">
                      {setting.data_type}
                    </Badge>
                  </div>
                  {setting.data_type === "boolean" ? (
                   <div className="pt-2">
                    <Switch
                        checked={formData[setting.key] || false}
                        onCheckedChange={(checked) => handleInputChange(setting.key, checked)}
                        className="scale-125 data-[state=checked]:bg-blue-500"
                      />
                   </div>
                  ) : (
                    <div className="relative">
                      <Input
                        type={setting.data_type === "number" ? "number" : "text"}
                        value={formData[setting.key] || (setting.data_type === "number" ? 0 : "")}
                        onChange={(e) => handleInputChange(setting.key, setting.data_type === "number" ? Number.parseFloat(e.target.value) || 0 : e.target.value)}
                        className="h-16 px-6 rounded-2xl border-none bg-white shadow-sm font-black text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 transition-all"
                      />
                      {setting.key === "quote_validity_days" && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300 text-xs uppercase italic pr-2">Días</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
