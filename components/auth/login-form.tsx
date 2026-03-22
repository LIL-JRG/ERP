"use client"

import type React from "react"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Wrench } from "lucide-react"

export default function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setMessage(error.message)
      }
    } catch (error) {
      setMessage("Error al iniciar sesión")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6 lg:p-12 relative overflow-hidden selection:bg-emerald-100 selection:text-emerald-900">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-50 rounded-full blur-[120px] opacity-60" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-[120px] opacity-60" />

      <Card className="w-full max-w-xl border-none shadow-2xl rounded-[40px] overflow-hidden bg-white/80 backdrop-blur-xl relative z-10 p-4 lg:p-8">
        <CardHeader className="text-center pt-12 pb-8">
          <div className="flex justify-center mb-8">
            <div className="bg-[#10b981] p-6 rounded-[32px] shadow-lg shadow-emerald-200">
              <Wrench className="h-10 w-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-6xl font-black text-slate-900 tracking-tighter leading-none mb-4">
            H2R
            <span className="text-[#10b981]"> ERP</span>
            <span className="text-lg block mt-2 text-slate-400 font-bold uppercase tracking-[0.3em]">v2.0</span>
          </CardTitle>
          <CardDescription className="text-lg font-bold text-slate-400 max-w-sm mx-auto">
            Bienvenido de nuevo.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-12">
          <form onSubmit={handleLogin} className="space-y-8">
            <div className="space-y-4">
              <div className="space-y-2.5">
                <Label htmlFor="email" className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ejemplo@h2r.com"
                  className="h-16 bg-slate-50 border-none rounded-3xl text-lg font-black text-slate-700 placeholder:text-slate-300 focus-visible:ring-2 focus-visible:ring-emerald-500/20 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="password" title="Contraseña" className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••••••"
                  className="h-16 bg-slate-50 border-none rounded-3xl text-lg font-black text-slate-700 placeholder:text-slate-300 focus-visible:ring-2 focus-visible:ring-emerald-500/20 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {message && (
              <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-sm font-bold text-center border border-rose-100 animate-in fade-in zoom-in duration-300">
                {message}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-16 rounded-[28px] bg-[#10b981] hover:bg-[#059669] text-white font-black text-lg uppercase tracking-[0.2em] shadow-xl shadow-emerald-200 transition-all active:scale-[0.98] disabled:opacity-50"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                   <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                   <span>Autenticando...</span>
                </div>
              ) : "Acceder al Sistema"}
            </Button>
            
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
