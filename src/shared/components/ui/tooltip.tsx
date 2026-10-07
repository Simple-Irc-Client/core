"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@shared/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

// Radix keeps a tooltip open while the pointer rests on the trigger, e.g. a just-clicked channel
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

// Radix opens on any focus not started by a pointer press, including the focus the browser hands back to
// a clicked trigger when the window is restored; only keyboard (focus-visible) focus should open it
const TooltipTrigger = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(({ onFocus, ...props }, ref) => (
  <TooltipPrimitive.Trigger
    ref={ref}
    onFocus={(event) => {
      onFocus?.(event)
      if (!event.currentTarget.matches(":focus-visible")) event.preventDefault()
    }}
    {...props}
  />
))
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName

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
