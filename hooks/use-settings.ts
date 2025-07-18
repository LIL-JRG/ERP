"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

interface Settings {
  tax_enabled: boolean
  tax_rate: number
  business_name: string
  business_address: string
  business_phone: string
  business_email: string
  currency: string
  currency_symbol: string
  low_stock_threshold: number
  quote_validity_days: number
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({
    tax_enabled: false,
    tax_rate: 16,
    business_name: "H2R ACCESORIOS PARA EL CICLISTA",
    business_address: "",
    business_phone: "",
    business_email: "",
    currency: "MXN",
    currency_symbol: "$",
    low_stock_threshold: 5,
    quote_validity_days: 7,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from("settings").select("*")

      if (error) throw error

      const settingsObject: any = {}
      ;(data || []).forEach((setting) => {
        switch (setting.data_type) {
          case "boolean":
            settingsObject[setting.key] = setting.value === "true"
            break
          case "number":
            settingsObject[setting.key] = Number.parseFloat(setting.value) || 0
            break
          default:
            settingsObject[setting.key] = setting.value || ""
        }
      })

      setSettings((prev) => ({ ...prev, ...settingsObject }))
    } catch (error) {
      console.error("Error fetching settings:", error)
    } finally {
      setLoading(false)
    }
  }

  const calculateTax = (amount: number) => {
    if (!settings.tax_enabled) return 0
    return (amount * settings.tax_rate) / 100
  }

  const formatCurrency = (amount: number) => {
    return `${settings.currency_symbol}${amount.toFixed(2)}`
  }

  return {
    settings,
    loading,
    calculateTax,
    formatCurrency,
    refreshSettings: fetchSettings,
  }
}
