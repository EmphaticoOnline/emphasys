import type { ReactNode } from "react"
import { CompassProvider } from "@/lib/store"
import { SidebarNav } from "./sidebar-nav"
import { BottomNav } from "./bottom-nav"
import { QuickCapture } from "./quick-capture"
import { RealWorkProvider } from "@/lib/real-work-store"
import "../../compass.css"
import "@fontsource/manrope/400.css"
import "@fontsource/manrope/500.css"
import "@fontsource/manrope/600.css"
import "@fontsource/manrope/700.css"
import "@fontsource/space-grotesk/500.css"
import "@fontsource/instrument-serif/400.css"
import "@fontsource/instrument-serif/400-italic.css"
import "@fontsource/jetbrains-mono/400.css"
import "@fontsource/jetbrains-mono/500.css"
import "@fontsource/jetbrains-mono/600.css"

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CompassProvider><RealWorkProvider>
      <div className="compass-root flex min-h-dvh flex-col md:flex-row">
        <SidebarNav />
        <main className="min-h-dvh flex-1 pb-24 md:pb-0">
          <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-10 md:px-10 md:pt-10">{children}</div>
        </main>
        <div className="fixed right-5 bottom-20 z-40 md:hidden">
          <QuickCapture />
        </div>
        <BottomNav />
      </div>
    </RealWorkProvider></CompassProvider>
  )
}
