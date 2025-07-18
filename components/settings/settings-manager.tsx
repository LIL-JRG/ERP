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
    return <div className="flex justify-center items-center h-64">Cargando configuración...</div>
  }

  const businessSettings = settings.filter((s) => s.key.startsWith("business_") || s.key.includes("currency"))
  const taxSettings = settings.filter((s) => s.key.startsWith("tax_"))
  const generalSettings = settings.filter(
    (s) => !s.key.startsWith("business_") && !s.key.startsWith("tax_") && !s.key.includes("currency"),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Configuración</h2>
          <p className="text-gray-600">Administra la configuración general del sistema</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>

      <Tabs defaultValue="business" className="space-y-4">
        <TabsList>
          <TabsTrigger value="business">
            <Building className="h-4 w-4 mr-2" />
            Negocio
          </TabsTrigger>
          <TabsTrigger value="taxes">
            <Calculator className="h-4 w-4 mr-2" />
            Impuestos
          </TabsTrigger>
          <TabsTrigger value="general">
            <Settings className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Información del Negocio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {businessSettings.map((setting) => (
                  <div key={setting.key}>{renderField(setting)}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="taxes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Impuestos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {taxSettings.map((setting) => (
                  <div key={setting.key}>{renderField(setting)}</div>
                ))}
              </div>

              <div className="bg-blue-50 p-4 rounded-md">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2" />
                  <div>
                    <h4 className="font-medium text-blue-900">Información sobre IVA</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      El IVA se calcula después de aplicar los descuentos de cliente. Si deshabilitas el IVA, no se
                      agregará ningún impuesto a las ventas y cotizaciones.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border rounded-md p-4">
                <h4 className="font-medium mb-2">Vista previa del cálculo:</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>$1,000.00</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Descuento (10%):</span>
                    <span>-$100.00</span>
                  </div>
                  {formData.tax_enabled && (
                    <div className="flex justify-between">
                      <span>IVA ({formData.tax_rate || 0}%):</span>
                      <span>${(((1000 - 100) * (formData.tax_rate || 0)) / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>Total:</span>
                    <span>
                      ${formData.tax_enabled ? (900 + (900 * (formData.tax_rate || 0)) / 100).toFixed(2) : "900.00"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generalSettings.map((setting) => (
                  <div key={setting.key}>{renderField(setting)}</div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Información del Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{settings.length}</div>
                  <div className="text-sm text-gray-600">Configuraciones</div>
                </div>
                <div className="text-center">
                  <Badge className="bg-green-100 text-green-800">Activo</Badge>
                  <div className="text-sm text-gray-600 mt-1">Estado del Sistema</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium">v1.0.0</div>
                  <div className="text-sm text-gray-600">Versión</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
