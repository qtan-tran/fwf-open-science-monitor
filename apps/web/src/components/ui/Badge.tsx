interface BadgeProps {
  label: string;
  variant?: "success" | "warning" | "info" | "neutral";
}

const VARIANT_CLASSES: Record<NonNullable<BadgeProps["variant"]>, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-500/30",
  warning: "bg-amber-50  text-amber-700  ring-amber-600/20  dark:bg-amber-900/30  dark:text-amber-400  dark:ring-amber-500/30",
  info:    "bg-blue-50   text-blue-700   ring-blue-600/20   dark:bg-blue-900/30   dark:text-blue-400   dark:ring-blue-500/30",
  neutral: "bg-gray-50   text-gray-600   ring-gray-500/20   dark:bg-gray-800      dark:text-gray-400   dark:ring-gray-600/30",
};

export function Badge({ label, variant = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${VARIANT_CLASSES[variant]}`}
    >
      {label}
    </span>
  );
}
