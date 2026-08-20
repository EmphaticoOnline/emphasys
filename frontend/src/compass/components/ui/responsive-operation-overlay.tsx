"use client"

import { useEffect, useState, type ReactElement, type ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

function useDesktopOverlay() {
  const [desktop, setDesktop] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches)

  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)")
    const update = () => setDesktop(media.matches)
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  return desktop
}

export function ResponsiveOperationOverlay({
  open,
  onOpenChange,
  trigger,
  eyebrow,
  title,
  description,
  children,
  footer,
  footerClassName,
  contentClassName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger?: ReactElement
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  footerClassName?: string
  contentClassName?: string
}) {
  const desktop = useDesktopOverlay()
  const header = (Title: typeof DialogTitle | typeof DrawerTitle, Description: typeof DialogDescription | typeof DrawerDescription) => (
    <div className="flex shrink-0 flex-col gap-1.5">
      {eyebrow && <span className="font-mono-compass text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">{eyebrow}</span>}
      <Title className="font-editorial text-2xl leading-tight font-normal text-foreground">{title}</Title>
      {description && <Description className="text-sm text-pretty text-muted-foreground">{description}</Description>}
    </div>
  )
  const body = <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 sm:px-0 sm:py-5">{children}</div>
  const actions = footer ? <div className={cn("flex shrink-0 flex-col gap-2 border-t border-border/80 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:flex-row-reverse sm:items-center sm:justify-start sm:px-0 sm:pb-0", footerClassName)}>{footer}</div> : null

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger && <DialogTrigger render={trigger} />}
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-black/20"
          className={cn("compass-overlay-theme flex max-h-[88vh] w-full max-w-lg grid-cols-none flex-col gap-0 rounded-2xl border border-border/80 bg-popover p-6 text-popover-foreground shadow-[0_24px_70px_rgba(51,45,35,0.18)] ring-0", contentClassName)}
        >
          {header(DialogTitle, DialogDescription)}
          {body}
          {actions}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      {trigger && <DrawerTrigger render={trigger} />}
      <DrawerContent className={cn("compass-overlay-theme max-h-[calc(100dvh-2rem)]", contentClassName)}>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-0 pt-2">
          <div className="px-4 pt-2 text-center">{header(DrawerTitle, DrawerDescription)}</div>
          {body}
          {actions}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
