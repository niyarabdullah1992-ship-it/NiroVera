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
          "border-[#E2E8F0] bg-white text-[#14284B] before:absolute before:inset-y-0 before:start-0 before:w-[3px] before:bg-[#14284B]",
        success:
          "border-[color-mix(in_oklab,#1E9E63_32%,#fff)] bg-[color-mix(in_oklab,#1E9E63_9%,#fff)] text-[#14284B] before:absolute before:inset-y-0 before:start-0 before:w-[3px] before:bg-[#1E9E63]",
        warning:
          "border-[#FDE68A] bg-[#FFFBEB] text-[#14284B] before:absolute before:inset-y-0 before:start-0 before:w-[3px] before:bg-[#D97706]",
        destructive:
          "destructive border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] before:absolute before:inset-y-0 before:start-0 before:w-[3px] before:bg-[#DC2626]",
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
      "inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-medium text-[#14284B]",
      "transition-colors hover:bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#1E9E63]/40",
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
      "absolute end-2 top-2 rounded-md p-1 text-[#5A6B85]/70 transition-opacity",
      "opacity-70 hover:opacity-100 hover:text-[#14284B] focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#14284B]/20",
      "group-[.destructive]:text-[#B91C1C]/70 group-[.destructive]:hover:text-[#991B1B]",
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
    className={cn("text-[12.5px] leading-[1.55] text-start text-[#5A6B85] group-[.destructive]:text-[#991B1B]/90", className)}
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
