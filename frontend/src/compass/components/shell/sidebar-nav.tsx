"use client"

import { Link, useLocation, useNavigate } from "react-router-dom"
import { navPrincipal, navSecundaria } from "@/lib/nav"
import { cn } from "@/lib/utils"
import { QuickCapture } from "./quick-capture"
import { LogOut } from "lucide-react"
import { useSession } from "../../../session/useSession"
import emphasysColibriUrl from "../../../assets/emphasys-colibri-w.png"

export function SidebarNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { logout } = useSession()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar px-5 py-8 md:flex">
      <div className="flex items-center gap-2.5 px-1">
        <span
          aria-hidden="true"
          className="size-6 shrink-0 bg-primary"
          style={{
            maskImage: `url(${emphasysColibriUrl})`,
            maskPosition: "center",
            maskRepeat: "no-repeat",
            maskSize: "contain",
            WebkitMaskImage: `url(${emphasysColibriUrl})`,
            WebkitMaskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskSize: "contain",
          }}
        />
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
      <button
        type="button"
        onClick={handleLogout}
        className="mt-5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      >
        <LogOut className="size-4.5" strokeWidth={1.75} />
        Cerrar sesión
      </button>
    </aside>
  )
}
