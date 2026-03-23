import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: {
    value: string
    isPositive: boolean
  }
  badge?: {
    text: string
    type: "success" | "warning" | "neutral"
  }
  trendLabel?: string
  footer?: React.ReactNode
  loading?: boolean
  className?: string
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  loading,
  className,
  badge,
  footer,
  trendLabel = "vs mes ant."
}: StatCardProps) {
  if (loading) {
    return (
      <Card className={cn("border-none shadow-sm rounded-[32px] overflow-hidden bg-white animate-pulse", className)}>
        <CardContent className="p-7">
          <div className="flex justify-between items-start mb-6">
            <div className="h-4 w-24 bg-slate-100 rounded-full" />
            <div className="h-10 w-10 bg-slate-100 rounded-2xl" />
          </div>
          <div className="h-10 w-32 bg-slate-100 rounded-xl mb-4" />
          <div className="h-12 w-full bg-slate-50 rounded-2xl" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(
      "border-none shadow-sm rounded-[40px] overflow-hidden bg-white hover:shadow-lg transition-all duration-300 group",
      className
    )}>
      <CardContent className="p-10">
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-2 min-w-0">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] truncate">
              {title}
            </h3>
            {badge && (
              <span className={cn(
                "inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-tight",
                badge.type === 'success' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                badge.type === 'warning' ? "bg-amber-50 text-amber-600 border border-amber-100" :
                "bg-slate-50 text-slate-600 border border-slate-100"
              )}>
                {badge.text}
              </span>
            )}
          </div>
          <div className={cn(
            "p-5 rounded-[24px] bg-[#f8fafc] text-slate-400 group-hover:bg-[#10b981] group-hover:text-white transition-all duration-500 shadow-sm",
          )}>
            <Icon className="h-9 w-9" />
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-8">
          <div className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tighter flex items-baseline gap-2">
            {value}
          </div>
          {trend && (
            <div className={cn(
              "flex items-center gap-2 text-sm font-black",
              trend.isPositive ? "text-emerald-600" : "text-rose-600"
            )}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-current/10">
                {trend.isPositive ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
              </span>
              <span>{trend.value} <span className="text-slate-400 font-bold">{trendLabel}</span></span>
            </div>
          )}
        </div>

        {footer && (
          <div className="pt-5 border-t border-slate-50/80">
            {footer}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
