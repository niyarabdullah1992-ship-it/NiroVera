import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { CheckCircle2, Info, AlertTriangle, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

const ICONS = {
  default: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: XCircle,
};

const ICON_CLASS = {
  default: "text-[var(--nv-ink)]",
  success: "text-[var(--nv-ok-ink)]",
  warning: "text-[var(--nv-warn-ink)]",
  destructive: "text-[var(--nv-bad-ink)]",
};

const DISMISS_OFFSET = 88;
const DISMISS_VELOCITY = 620;

function SwipeToast({ id, title, description, action, variant = "default", onDismiss, ...props }) {
  const Icon = ICONS[variant] || ICONS.default;
  const iconClass = ICON_CLASS[variant] || ICON_CLASS.default;
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-220, -88, 0, 88, 220], [0.12, 0.5, 1, 0.5, 0.12]);
  const scale = useTransform(x, [-220, 0, 220], [0.96, 1, 0.96]);

  const settleBack = () => {
    animate(x, 0, { type: "spring", stiffness: 420, damping: 32, mass: 0.7 });
  };

  const flingAway = (dir) => {
    const target = dir * (typeof window !== "undefined" ? Math.max(window.innerWidth, 480) : 480);
    animate(x, target, {
      type: "spring",
      stiffness: 380,
      damping: 34,
      mass: 0.65,
      velocity: x.getVelocity(),
    });
    window.setTimeout(() => onDismiss(id), 160);
  };

  return (
    <motion.div
      style={{ x, opacity, scale, touchAction: "pan-y" }}
      drag="x"
      dragConstraints={{ left: -320, right: 320 }}
      dragElastic={0.42}
      dragMomentum={false}
      onDragEnd={(_, info) => {
        const offset = info.offset.x;
        const velocity = info.velocity.x;
        if (Math.abs(offset) > DISMISS_OFFSET || Math.abs(velocity) > DISMISS_VELOCITY) {
          flingAway(offset === 0 ? Math.sign(velocity) || 1 : Math.sign(offset));
          return;
        }
        settleBack();
      }}
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className="pointer-events-auto w-full cursor-grab active:cursor-grabbing select-none"
    >
      <Toast
        variant={variant}
        {...props}
        className="shadow-[0_10px_32px_rgba(20,40,75,0.12)]"
        role="status"
        aria-live="polite"
      >
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} aria-hidden />
        <div className="grid min-w-0 flex-1 gap-0.5">
          {title && <ToastTitle>{title}</ToastTitle>}
          {description && (
            <ToastDescription className={title ? undefined : "text-[var(--nv-ink)] group-[.destructive]:text-[var(--nv-bad-ink)]"}>
              {description}
            </ToastDescription>
          )}
        </div>
        {action}
        <ToastClose
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      </Toast>
    </motion.div>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      <ToastViewport>
        {toasts
          .filter((t) => t.open !== false)
          .map(function ({ id, title, description, action, variant = "default", ...props }) {
            return (
              <SwipeToast
                key={id}
                id={id}
                title={title}
                description={description}
                action={action}
                variant={variant}
                onDismiss={dismiss}
                {...props}
              />
            );
          })}
      </ToastViewport>
    </ToastProvider>
  );
}
