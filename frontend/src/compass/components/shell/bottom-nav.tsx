"use client"

import { Link, useLocation } from "react-router-dom"
import { useState } from "react"
import { MoreHorizontal } from "lucide-react"
import { navPrincipal, navSecundaria } from "@/lib/nav"
import { cn } from "@/lib/utils"
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

export function BottomNav() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const masActivo = navSecundaria.some((item) => item.href === pathname)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {navPrincipal.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" strokeWidth={active ? 2 : 1.75} />
              {item.label}
            </Link>
          )
        })}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <button
                type="button"
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
                  masActivo ? "text-primary" : "text-muted-foreground",
                )}
              >
                <MoreHorizontal className="size-5" strokeWidth={masActivo ? 2 : 1.75} />
                Más
              </button>
            }
          />
          <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <SheetHeader>
              <SheetTitle className="font-heading">Más</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-1 px-4">
              {navSecundaria.map((item) => (
                <SheetClose
                  key={item.href}
                  nativeButton={false}
                  render={
                    <Link
                      to={item.href}
                      className="flex items-center gap-3 rounded-lg px-2 py-3 text-sm text-foreground hover:bg-accent"
                    >
                      <item.icon className="size-4.5 text-muted-foreground" strokeWidth={1.75} />
                      {item.label}
                    </Link>
                  }
                />
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
