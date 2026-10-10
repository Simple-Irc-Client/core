import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check, ChevronRight, Circle } from "lucide-react"
import * as Sentry from "@sentry/react"

import { cn } from "@shared/lib/utils"

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

function composeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node)
      else if (ref) (ref as React.MutableRefObject<T | null>).current = node
    }
  }
}

// Diagnostic only: lets the trigger and content report to their DropdownMenuSub
interface SubmenuDiagnostics {
  registerTrigger: (el: HTMLElement | null) => void
  registerContent: (el: HTMLElement | null) => void
  noteLeave: (from: "trigger" | "content", event: React.MouseEvent) => void
}

const SubmenuDiagnosticsContext = React.createContext<SubmenuDiagnostics | null>(null)

// Diagnostic only: an element as tag and role, without its text
const describe = (el: Element | null | undefined) => (el ? `${el.tagName.toLowerCase()}[role=${el.getAttribute("role")}]` : "none")
const hoveredElement = () => describe([...document.querySelectorAll(":hover")].at(-1))

// Diagnostic only: a buffered replay uploads only with an exception, so flush it for these warnings;
// capturing after the flush tags the warning with the replay's id
const captureWarning = (message: string, extra: Record<string, unknown>) => {
  const capture = () => Sentry.captureMessage(message, { level: "warning", extra })
  const replay = Sentry.getReplay()
  if (!replay) {
    capture()
    return
  }
  void replay.flush().finally(capture)
}

// Diagnostic only: when the user last closed a menu on purpose (dismissed it or picked an item)
let lastUserCloseAt = 0
const closedByUser = () => Date.now() - lastUserCloseAt < 1000

// Diagnostic only, temporary (remove next release): what the webview delivered in the last few seconds
const TRAIL_MS = 3000
const trail: { at: number; entry: string }[] = []
const record = (entry: string) => {
  const now = Date.now()
  trail.push({ at: now, entry })
  while (trail.length > 300 || now - (trail[0]?.at ?? now) > TRAIL_MS) trail.shift()
}
const recentTrail = () => {
  const now = Date.now()
  return trail.filter(({ at }) => now - at <= TRAIL_MS).map(({ at, entry }) => `-${now - at}ms ${entry}`)
}
const describeTarget = (target: EventTarget | null) => {
  if (target === window) return "window"
  if (target === document) return "document"
  return describe(target instanceof Element ? target : null)
}
const describeEvent = (event: Event) => {
  const parts = [event.type, describeTarget(event.target)]
  if (event instanceof MouseEvent || event instanceof FocusEvent) parts.push(`→${describeTarget(event.relatedTarget)}`)
  if (event instanceof MouseEvent) parts.push(`(${event.clientX},${event.clientY})`, `buttons=${event.buttons}`)
  if (typeof PointerEvent !== "undefined" && event instanceof PointerEvent) parts.push(event.pointerType)
  if (event instanceof KeyboardEvent) parts.push(event.key.length > 1 ? event.key : "char")
  if (!event.isTrusted) parts.push("untrusted")
  return parts.join(" ")
}
const describeRect = (el: Element | null | undefined) => {
  if (!el) return "none"
  const r = el.getBoundingClientRect()
  return `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}${el.isConnected ? "" : " detached"}`
}
// Moves are counted, and logged at most every 100ms so they don't flood the trail
const moves = {
  pointermove: { count: 0, at: 0, loggedAt: 0 },
  mousemove: { count: 0, at: 0, loggedAt: 0 },
}
let lastPointer: { x: number; y: number; at: number } | null = null
const onMove = (event: MouseEvent) => {
  const stat = event.type === "pointermove" ? moves.pointermove : moves.mousemove
  const now = Date.now()
  stat.count++
  stat.at = now
  if (event.type === "pointermove") lastPointer = { x: event.clientX, y: event.clientY, at: now }
  if (now - stat.loggedAt >= 100) {
    stat.loggedAt = now
    record(describeEvent(event))
  }
}
if (typeof document !== "undefined") {
  document.addEventListener("menu.itemSelect", () => (lastUserCloseAt = Date.now()), true)
  document.addEventListener("pointermove", onMove, { capture: true, passive: true })
  document.addEventListener("mousemove", onMove, { capture: true, passive: true })
  for (const type of [
    "pointerover", "pointerout", "pointerdown", "pointerup", "pointercancel", "gotpointercapture", "lostpointercapture",
    "mouseover", "mouseout", "mousedown", "mouseup", "click", "contextmenu", "wheel", "scroll",
    "focusin", "focusout", "keydown",
  ]) {
    document.addEventListener(type, (event) => record(describeEvent(event)), { capture: true, passive: true })
  }
  document.addEventListener("visibilitychange", () => record(`visibilitychange ${document.visibilityState}`))
  for (const type of ["blur", "focus", "resize"]) {
    window.addEventListener(type, (event) => event.target === window && record(`window ${type}`))
  }
}

// Diagnostic only: Radix dismisses a menu through these handlers, so they say why a menu closed unasked
function useDismissReport(menu: "menu" | "submenu") {
  const openedAt = React.useRef(0)
  const node = React.useRef<HTMLElement | null>(null)
  // On the Radix content itself: our wrapper stays mounted while the menu is closed
  const ref = React.useCallback(
    (element: HTMLElement | null) => {
      if (element) {
        if (element !== node.current) openedAt.current = Date.now()
        node.current = element
        return
      }
      const detached = node.current
      // Still in the DOM a microtask later: only a re-render or StrictMode re-attached it
      queueMicrotask(() => {
        if (menu === "menu" && detached && !detached.isConnected && !closedByUser()) {
          captureWarning("Menu closed without user action", { msOpen: Date.now() - openedAt.current, trail: recentTrail() })
        }
      })
    },
    [menu]
  )
  const onDismiss = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null
    // Not a dismiss: the modal root cancels focus-outside, and a submenu stays open when focus is on its own trigger
    if (event.defaultPrevented || target?.getAttribute("aria-expanded") === "true") return
    lastUserCloseAt = Date.now()
    record(`${menu} dismiss ${describeEvent(event)}`)
    const data = {
      menu,
      kind: event.type,
      target: describe(target),
      msOpen: Date.now() - openedAt.current,
      windowFocused: document.hasFocus(),
    }
    Sentry.addBreadcrumb({ category: "menu-dismiss", level: "info", data })
    // A submenu close is already reported by DropdownMenuSub; this breadcrumb only adds why Radix closed it
    if (menu === "menu" && data.msOpen < 1000) {
      captureWarning("Menu dismissed suspiciously fast", { ...data, trail: recentTrail() })
    }
  }
  return { ref, onDismiss }
}

// Radix drives opening and closing; this wrapper only reports how long a submenu stayed open
const DropdownMenuSub = ({
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Sub>) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false)
  const open = openProp ?? uncontrolledOpen
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const contentRef = React.useRef<HTMLElement | null>(null)
  const openedAtRef = React.useRef<number | null>(null)
  const subRef = React.useRef<string | undefined>(undefined)
  const lastLeaveRef = React.useRef<{
    from: string
    relatedTarget: string
    x: number
    y: number
    at: number
    triggerRect: string
    contentRect: string
  } | null>(null)
  const movesAtOpenRef = React.useRef({ pointermove: 0, mousemove: 0 })

  const commit = React.useCallback(
    (next: boolean, reason: string) => {
      if (next) {
        openedAtRef.current = Date.now()
        subRef.current = triggerRef.current?.textContent?.trim()
        lastLeaveRef.current = null
        movesAtOpenRef.current = { pointermove: moves.pointermove.count, mousemove: moves.mousemove.count }
        record(`submenu opened (${reason}) trigger ${describeRect(triggerRef.current)}`)
      } else if (openedAtRef.current !== null) {
        const now = Date.now()
        const msOpen = now - openedAtRef.current
        openedAtRef.current = null
        const pointerTarget = lastPointer && document.elementFromPoint(lastPointer.x, lastPointer.y)
        const leave = lastLeaveRef.current
        // The DOM event being dispatched when the close was requested; none means a timer or other async path
        const currentEvent = window.event
        record(`submenu closed (${reason})`)
        // Radix also closes on unmount or a parent close; afterUserAction tells those from a dismiss or item pick
        const data = {
          msOpen,
          reason,
          sub: subRef.current,
          hovered: hoveredElement(),
          windowFocused: document.hasFocus(),
          afterUserAction: closedByUser(),
          // relatedTarget "window": the webview reported the pointer leaving the page (React maps a null relatedTarget to window)
          lastLeave: leave && { ...leave, msAgo: now - leave.at },
          lastPointer: lastPointer && {
            x: lastPointer.x,
            y: lastPointer.y,
            msAgo: now - lastPointer.at,
            hitTest: describe(pointerTarget),
            overSubmenu: Boolean(pointerTarget && (triggerRef.current?.contains(pointerTarget) || contentRef.current?.contains(pointerTarget))),
            stack: document.elementsFromPoint(lastPointer.x, lastPointer.y).slice(0, 6).map(describe).join(" > "),
          },
          // Moves delivered while open: pointer events stopping while mouse events go on is the suspected bug
          movesWhileOpen: {
            pointermove: moves.pointermove.count - movesAtOpenRef.current.pointermove,
            mousemove: moves.mousemove.count - movesAtOpenRef.current.mousemove,
            msSinceLastPointermove: moves.pointermove.at ? now - moves.pointermove.at : null,
            msSinceLastMousemove: moves.mousemove.at ? now - moves.mousemove.at : null,
          },
          duringEvent: currentEvent ? describeEvent(currentEvent) : "none",
          triggerRect: describeRect(triggerRef.current),
          contentRect: describeRect(contentRef.current),
          activeElement: describe(document.activeElement),
          visibility: document.visibilityState,
          viewport: `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio}`,
        }
        Sentry.addBreadcrumb({ category: "submenu-guard", message: `closed (${reason})`, level: "info", data })
        // A close this soon is the bug above slipping through; report it to Sentry
        if (msOpen < 1000) {
          captureWarning("DropdownMenuSub closed suspiciously fast", { ...data, trail: recentTrail() })
        }
      }
      setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange]
  )

  // Diagnostic only: re-renders, repositioning and highlight moves inside the open menu
  React.useEffect(() => {
    const root = open ? triggerRef.current?.closest("[data-radix-popper-content-wrapper]") : null
    if (!root) return
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const target = mutation.target instanceof Element ? mutation.target : null
        record(
          mutation.type === "childList"
            ? `mutation +${mutation.addedNodes.length} -${mutation.removedNodes.length} in ${describe(target)}`
            : `mutation ${mutation.attributeName}=${String(target?.getAttribute(mutation.attributeName ?? "")).slice(0, 120)} on ${describe(target)}`
        )
      }
    })
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state", "data-highlighted", "data-side", "style"] })
    observer.observe(document.body, { childList: true })
    return () => observer.disconnect()
  }, [open])

  const diagnostics = React.useMemo<SubmenuDiagnostics>(
    () => ({
      registerTrigger: (el) => {
        triggerRef.current = el
      },
      registerContent: (el) => {
        contentRef.current = el
      },
      noteLeave: (from, event) => {
        lastLeaveRef.current = {
          from,
          relatedTarget: describeTarget(event.relatedTarget),
          x: event.clientX,
          y: event.clientY,
          at: Date.now(),
          triggerRect: describeRect(triggerRef.current),
          contentRect: describeRect(contentRef.current),
        }
        record(`submenu: ${from} mouseleave ${describeEvent(event.nativeEvent)}`)
      },
    }),
    []
  )

  return (
    <SubmenuDiagnosticsContext.Provider value={diagnostics}>
      <DropdownMenuPrimitive.Sub
        {...props}
        open={open}
        onOpenChange={(next) => commit(next, next ? "radix-open-request" : "radix-close-request")}
      />
    </SubmenuDiagnosticsContext.Provider>
  )
}

const DropdownMenuSubTrigger = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, onMouseLeave, ...props }, forwardedRef) => {
  const diagnostics = React.useContext(SubmenuDiagnosticsContext)

  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={composeRefs(forwardedRef, diagnostics?.registerTrigger)}
      className={cn(
        "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        inset && "pl-8",
        className
      )}
      onMouseLeave={(event) => {
        diagnostics?.noteLeave("trigger", event)
        onMouseLeave?.(event)
      }}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto" />
    </DropdownMenuPrimitive.SubTrigger>
  )
})
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, onMouseLeave, onFocusOutside, onEscapeKeyDown, ...props }, forwardedRef) => {
  const diagnostics = React.useContext(SubmenuDiagnosticsContext)
  const dismissReport = useDismissReport("submenu")

  return (
    <DropdownMenuPrimitive.SubContent
      ref={composeRefs(forwardedRef, diagnostics?.registerContent, dismissReport.ref)}
      className={cn(
        "z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-dropdown-menu-content-transform-origin)",
        className
      )}
      onMouseLeave={(event) => {
        diagnostics?.noteLeave("content", event)
        onMouseLeave?.(event)
      }}
      // onFocusOutside, not onInteractOutside: it runs before Radix's own handler closes the submenu
      onFocusOutside={(event) => {
        dismissReport.onDismiss(event)
        onFocusOutside?.(event)
      }}
      onEscapeKeyDown={(event) => {
        dismissReport.onDismiss(event)
        onEscapeKeyDown?.(event)
      }}
      {...props}
    />
  )
})
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, onInteractOutside, onEscapeKeyDown, ...props }, ref) => {
  const dismissReport = useDismissReport("menu")

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={composeRefs(ref, dismissReport.ref)}
        sideOffset={sideOffset}
        onInteractOutside={(event) => {
          dismissReport.onDismiss(event)
          onInteractOutside?.(event)
        }}
        onEscapeKeyDown={(event) => {
          dismissReport.onDismiss(event)
          onEscapeKeyDown?.(event)
        }}
        className={cn(
          "z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-32 overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-dropdown-menu-content-transform-origin)",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
})
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden transition-colors focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-hidden transition-colors focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-hidden transition-colors focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-sm font-semibold",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
      {...props}
    />
  )
}
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
