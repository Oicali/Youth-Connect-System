import { Skeleton } from "@/components/ui/skeleton";

// one headline number with a tinted icon badge, same badge style as the modals
// badgeClass / iconClass default to the old gold look, so unchanged callers still work
export function StatCard({
  label,
  value,
  icon: Icon,
  loading,
  badgeClass = "bg-primary/10",
  iconClass = "text-accent-ink",
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-5">
      <div className={`flex size-11 shrink-0 items-center justify-center rounded-full ${badgeClass}`}>
        <Icon size={20} className={iconClass} />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-8 w-14" />
        ) : (
          <p className="text-3xl font-bold leading-tight">{value ?? 0}</p>
        )}
      </div>
    </div>
  );
}