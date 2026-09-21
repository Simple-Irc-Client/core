"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@shared/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

// Radix keeps a tooltip open for as long as the pointer rests on the trigger,
// so a cursor parked on e.g. a channel after switching to it leaves the hint
// hanging over the UI indefinitely. Close it after a while; Radix does not
// re-open on a stationary pointer, only after it leaves and re-enters.
const TOOLTIP_AUTO_CLOSE_MS = 10000

type TooltipProps = Omit<TooltipPrimitive.TooltipProps, "open" | "defaultOpen" | "onOpenChange">

function Tooltip(props: TooltipProps) {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => setOpen(false), TOOLTIP_AUTO_CLOSE_MS)
    return () => clearTimeout(timer)
  }, [open])

  return <TooltipPrimitive.Root {...props} open={open} onOpenChange={setOpen} />
}

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
