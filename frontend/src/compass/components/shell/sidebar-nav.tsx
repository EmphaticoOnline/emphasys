"use client"

import { Link, useLocation } from "react-router-dom"
import { Compass } from "lucide-react"
import { navPrincipal, navSecundaria } from "@/lib/nav"
import { cn } from "@/lib/utils"
import { QuickCapture } from "./quick-capture"

export function SidebarNav() {
  const { pathname } = useLocation()

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar px-5 py-8 md:flex">
      <div className="flex items-center gap-2.5 px-1">
        <Compass className="size-6 text-primary" strokeWidth={1.75} />
        <span className="font-heading text-lg tracking-tight text-foreground">Compass</span>
      </div>

      <nav className="mt-10 flex flex-col gap-1">
        {navPrincipal.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <item.icon className="size-4.5" strokeWidth={1.75} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-8 h-px bg-sidebar-border" />

      <nav className="mt-8 flex flex-col gap-1">
        {navSecundaria.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <item.icon className="size-4.5" strokeWidth={1.75} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto flex items-center gap-3 pt-8">
        <QuickCapture className="size-11 shadow-none" />
        <div className="text-sm">
          <p className="font-medium text-foreground">Capturar</p>
          <p className="text-xs text-muted-foreground">Siempre accesible</p>
        </div>
      </div>
    </aside>
  )
}
