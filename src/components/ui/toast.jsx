import * as React from "react";
import { cva } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("contents", className)} {...props} />
));
ToastProvider.displayName = "ToastProvider";

const ToastViewport = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "fixed bottom-4 end-4 z-[100] flex max-h-[min(100vh,480px)] w-full max-w-[min(100vw-1.5rem,380px)] flex-col gap-2 p-0",
      "pointer-events-none",
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = "ToastViewport";

const toastVariants = cva(
  [
    "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden",
    "rounded-none border px-3.5 py-3 pe-10",
    "shadow-[0_10px_32px_rgba(20,40,75,0.12)]",
    "will-change-transform",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "border-[var(--nv-line)] bg-[var(--nv-card)] text-[var(--nv-ink)] before:absolute before:inset-y-0 before:start-0 before:w-[3px] before:bg-[var(--nv-navy)]",
        success:
          "border-[color-mix(in_oklab,var(--nv-ok-ink)_32%,#fff)] bg-[color-mix(in_oklab,var(--nv-ok-ink)_9%,#fff)] text-[var(--nv-ink)] before:absolute before:inset-y-0 before:start-0 before:w-[3px] before:bg-[var(--nv-btn-fill)]",
        warning:
          "border-[var(--nv-line)] bg-[var(--nv-warn-soft)] text-[var(--nv-ink)] before:absolute before:inset-y-0 before:start-0 before:w-[3px] before:bg-[var(--nv-warn-fill)]",
        destructive:
          "destructive border-[var(--nv-line)] bg-[var(--nv-bad-soft)] text-[var(--nv-bad-ink)] before:absolute before:inset-y-0 before:start-0 before:w-[3px] before:bg-[var(--nv-bad-fill)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Toast = React.forwardRef(({ className, variant, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-state="open"
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  );
});
Toast.displayName = "Toast";

const ToastAction = React.forwardRef(({ className, ...props }, ref) => (
  <button
    type="button"
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-[var(--nv-line)] bg-[var(--nv-card)] px-3 text-xs font-medium text-[var(--nv-ink)]",
      "transition-colors hover:bg-[var(--nv-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--nv-accent-border)]/40",
      "disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
));
ToastAction.displayName = "ToastAction";

const ToastClose = React.forwardRef(({ className, ...props }, ref) => (
  <button
    type="button"
    ref={ref}
    className={cn(
      "absolute end-2 top-2 rounded-md p-1 text-[var(--nv-muted)]/70 transition-opacity",
      "opacity-70 hover:opacity-100 hover:text-[var(--nv-ink)] focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--nv-navy)]/20",
      "group-[.destructive]:text-[var(--nv-bad-ink)]/70 group-[.destructive]:hover:text-[var(--nv-bad-ink)]",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </button>
));
ToastClose.displayName = "ToastClose";

const ToastTitle = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-[13px] font-semibold leading-snug text-start", className)}
    {...props}
  />
));
ToastTitle.displayName = "ToastTitle";

const ToastDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-[12.5px] leading-[1.55] text-start text-[var(--nv-muted)] group-[.destructive]:text-[var(--nv-bad-ink)]/90", className)}
    {...props}
  />
));
ToastDescription.displayName = "ToastDescription";

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
