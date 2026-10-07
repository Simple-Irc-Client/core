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

interface SubmenuGuard {
  registerTrigger: (el: HTMLElement | null) => void
  registerContent: (el: HTMLElement | null) => void
  cancelClose: () => void
  scheduleClose: () => void
}

const SubmenuGuardContext = React.createContext<SubmenuGuard | null>(null)

// Diagnostic only: an element as tag and role, without its text
const describe = (el: Element | null | undefined) => (el ? `${el.tagName.toLowerCase()}[role=${el.getAttribute("role")}]` : "none")
const hoveredElement = () => describe([...document.querySelectorAll(":hover")].at(-1))

// Diagnostic only: when the user last closed a menu on purpose (dismissed it or picked an item)
let lastUserCloseAt = 0
const closedByUser = () => Date.now() - lastUserCloseAt < 1000
if (typeof document !== "undefined") {
  document.addEventListener("menu.itemSelect", () => (lastUserCloseAt = Date.now()), true)
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
          Sentry.captureMessage("Menu closed without user action", { level: "warning", extra: { msOpen: Date.now() - openedAt.current } })
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
      Sentry.captureMessage("Menu dismissed suspiciously fast", { level: "warning", extra: data })
    }
  }
  return { ref, onDismiss }
}

// macOS WKWebView can stop delivering the pointer events Radix's hover intent needs, closing a submenu
// ~1s after it opens. `:hover` stays correct, so it vetoes Radix's close while the pointer is still over
// the trigger/submenu; our mouseenter/mouseleave drive the real close. (Related upstream: radix-ui/primitives
// #4036, #3082, #3761, #923.)
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
  const closeTimerRef = React.useRef<number | undefined>(undefined)
  // Diagnostic only, for the captureMessage below
  const openedAtRef = React.useRef<number | null>(null)
  const subRef = React.useRef<string | undefined>(undefined)

  const commit = React.useCallback(
    (next: boolean, reason: string) => {
      if (next) {
        openedAtRef.current = Date.now()
        subRef.current = triggerRef.current?.textContent?.trim()
      } else if (openedAtRef.current !== null) {
        const msOpen = Date.now() - openedAtRef.current
        openedAtRef.current = null
        // Radix also closes on unmount or a parent close; afterUserAction tells those from a dismiss or item pick
        const data = {
          msOpen,
          reason,
          sub: subRef.current,
          hovered: hoveredElement(),
          windowFocused: document.hasFocus(),
          afterUserAction: closedByUser(),
        }
        Sentry.addBreadcrumb({ category: "submenu-guard", message: `closed (${reason})`, level: "info", data })
        // A close this soon is the bug above slipping through; report it to Sentry
        if (msOpen < 1000) {
          Sentry.captureMessage("DropdownMenuSub closed suspiciously fast", {
            level: "warning",
            extra: data,
          })
        }
      }
      setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange]
  )

  const cancelClose = React.useCallback(() => {
    if (closeTimerRef.current !== undefined) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = undefined
    }
  }, [])

  const isPointerOverSubmenu = React.useCallback(
    () =>
      Boolean(triggerRef.current?.matches(":hover")) ||
      Boolean(contentRef.current?.matches(":hover")),
    []
  )

  const scheduleClose = React.useCallback(() => {
    cancelClose()
    closeTimerRef.current = window.setTimeout(() => {
      if (isPointerOverSubmenu()) {
        Sentry.addBreadcrumb({ category: "submenu-guard", message: "hover timer fired — pointer still over, close skipped", level: "debug" })
      } else {
        commit(false, "hover-timer-expired")
      }
    }, 200)
  }, [cancelClose, isPointerOverSubmenu, commit])

  React.useEffect(() => () => cancelClose(), [cancelClose])

  const guard = React.useMemo<SubmenuGuard>(
    () => ({
      registerTrigger: (el) => {
        triggerRef.current = el
      },
      registerContent: (el) => {
        contentRef.current = el
      },
      cancelClose,
      scheduleClose,
    }),
    [cancelClose, scheduleClose]
  )

  return (
    <SubmenuGuardContext.Provider value={guard}>
      <DropdownMenuPrimitive.Sub
        {...props}
        open={open}
        onOpenChange={(next) => {
          if (!next && isPointerOverSubmenu()) {
            Sentry.addBreadcrumb({ category: "submenu-guard", message: "radix requested close — vetoed, pointer still over", level: "debug" })
            return
          }
          cancelClose()
          commit(next, next ? "radix-open-request" : "radix-close-request")
        }}
      />
    </SubmenuGuardContext.Provider>
  )
}

const DropdownMenuSubTrigger = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, onMouseEnter, onMouseLeave, ...props }, forwardedRef) => {
  const guard = React.useContext(SubmenuGuardContext)

  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={composeRefs(forwardedRef, guard?.registerTrigger)}
      className={cn(
        "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        inset && "pl-8",
        className
      )}
      onMouseEnter={(event) => {
        guard?.cancelClose()
        onMouseEnter?.(event)
      }}
      onMouseLeave={(event) => {
        guard?.scheduleClose()
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
>(({ className, onMouseEnter, onMouseLeave, onFocusOutside, onEscapeKeyDown, ...props }, forwardedRef) => {
  const guard = React.useContext(SubmenuGuardContext)
  const dismissReport = useDismissReport("submenu")

  return (
    <DropdownMenuPrimitive.SubContent
      ref={composeRefs(forwardedRef, guard?.registerContent, dismissReport.ref)}
      className={cn(
        "z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-dropdown-menu-content-transform-origin)",
        className
      )}
      onMouseEnter={(event) => {
        guard?.cancelClose()
        onMouseEnter?.(event)
      }}
      onMouseLeave={(event) => {
        guard?.scheduleClose()
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
