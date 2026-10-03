import { useState, useEffect, useCallback, useRef } from "react";
import { Search as SearchIcon, Undo2, UserPlus, Home, Trash2, Archive, Pencil } from "lucide-react";
import { toast } from "sonner";

import { fetchMembers, markConnectionRemoved } from "@/lib/api/members";
import { AddConnectMemberModal } from "@/components/AddConnectMemberModal";
import { EditConnectMemberModal } from "@/components/EditConnectMemberModal";
import { JoinCareGroupModal } from "@/components/JoinCareGroupModal";
import { ArchiveConnectMembersModal } from "@/components/ArchiveConnectMembersModal";
import { useErrorModal } from "@/context/ErrorModalContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const GENDER_LABELS = { all: "All genders", male: "Male", female: "Female" };
const ASSIGNED_LABELS = { all: "All", yes: "Assigned", no: "Not assigned" };

const MONTH_LABELS = {
  all: "All months", 1: "January", 2: "February", 3: "March", 4: "April",
  5: "May", 6: "June", 7: "July", 8: "August", 9: "September",
  10: "October", 11: "November", 12: "December",
};

// last 5 years back from now — adjust the range if your Connect data goes back further
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, idx) => CURRENT_YEAR - idx);

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const LIMIT = 15;

export default function Connect() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pendingGender, setPendingGender] = useState("all");
  const [gender, setGender] = useState("all");
  const [pendingAssigned, setPendingAssigned] = useState("all");
  const [assigned, setAssigned] = useState("all");
  const [pendingMonth, setPendingMonth] = useState("all");
  const [month, setMonth] = useState("all");
  const [pendingYear, setPendingYear] = useState("all");
  const [year, setYear] = useState("all");

  const { showError } = useErrorModal();

  const [addOpen, setAddOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [joinTarget, setJoinTarget] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [editingMember, setEditingMember] = useState(null);

  // holds the controller of the in-flight request so the next call can cancel it
  const abortRef = useRef(null);

  const loadMembers = useCallback(async () => {
    // cancel whatever is still pending, then start a fresh controller for this call
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const { members, total } = await fetchMembers({
        search,
        gender,
        // "active" = still in the Connect pipeline (pending or assigned) — excludes
        // full members (connection_status NULL) and archived ones (removed), which
        // ArchiveConnectMembersModal handles separately
        connectionStatus: "active",
        hasAssigned: assigned === "yes" ? "true" : assigned === "no" ? "false" : undefined,
        addedMonth: month !== "all" ? month : undefined,
        addedYear: year !== "all" ? year : undefined,
        sort: "no_assigned_first_added",
        page,
        limit: LIMIT,
        signal: controller.signal,
      });
      setMembers(members);
      setTotal(total);
    } catch (err) {
      // a cancelled request is intentional, not a failure: no error modal
      if (err.name === "AbortError") return;
      showError(err.message, "Could Not Load Connect List");
    } finally {
      // only the newest request may turn the skeleton off
      if (abortRef.current === controller) setLoading(false);
    }
  }, [search, gender, assigned, month, year, page]);

  // cancel any pending request when leaving the page
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const handleApplyFilters = () => {
    setSearch(searchInput.trim());
    setGender(pendingGender);
    setAssigned(pendingAssigned);
    setMonth(pendingMonth);
    setYear(pendingYear);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchInput(""); setSearch("");
    setPendingGender("all"); setGender("all");
    setPendingAssigned("all"); setAssigned("all");
    setPendingMonth("all"); setMonth("all");
    setPendingYear("all"); setYear("all");
    setPage(1);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); handleApplyFilters(); }
  };

  const filtersDirty =
    searchInput.trim() !== search ||
    pendingGender !== gender ||
    pendingAssigned !== assigned ||
    pendingMonth !== month ||
    pendingYear !== year;

  const filtersAtDefault =
    !searchInput && !search &&
    pendingGender === "all" && gender === "all" &&
    pendingAssigned === "all" && assigned === "all" &&
    pendingMonth === "all" && month === "all" &&
    pendingYear === "all" && year === "all";

  const handleConfirmRemove = async () => {
    try {
      await markConnectionRemoved(removeTarget.id);
      toast.success(`${removeTarget.first_name} marked as removed`);
      setRemoveTarget(null);
      loadMembers();
    } catch (err) {
      showError(err.message, "Could Not Remove");
    }
  };

  return (
    <div className="space-y-4">
      {/* header: stacked on mobile, side by side from sm up */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Connect</h1>
          <p className="text-sm text-muted-foreground">Follow up first-timers before they join a care group</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setArchiveOpen(true)}>
            <Archive size={16} className="mr-2" />
            Archive
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus size={16} className="mr-2" />
            Add first-timer
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[200px] flex-1 flex-col gap-1">
            <span className="px-1 text-xs text-muted-foreground">Search</span>
            <Input
              placeholder="Search name, phone, or church..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="bg-card"
            />
          </div>

          <div className="flex min-w-[140px] flex-1 flex-col gap-1 sm:flex-none">
            <span className="px-1 text-xs text-muted-foreground">Gender</span>
            <Select value={pendingGender} onValueChange={setPendingGender}>
              <SelectTrigger className="w-full bg-card sm:w-40">
                <SelectValue placeholder="Gender">{GENDER_LABELS[pendingGender]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All genders</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-[140px] flex-1 flex-col gap-1 sm:flex-none">
            <span className="px-1 text-xs text-muted-foreground">Assigned</span>
            <Select value={pendingAssigned} onValueChange={setPendingAssigned}>
              <SelectTrigger className="w-full bg-card sm:w-36">
                <SelectValue placeholder="Assigned">{ASSIGNED_LABELS[pendingAssigned]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Assigned</SelectItem>
                <SelectItem value="no">Not assigned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-[140px] flex-1 flex-col gap-1 sm:flex-none">
            <span className="px-1 text-xs text-muted-foreground">Created month</span>
            <Select value={String(pendingMonth)} onValueChange={(v) => setPendingMonth(v === "all" ? "all" : Number(v))}>
              <SelectTrigger className="w-full bg-card sm:w-36">
                <SelectValue placeholder="Month">{MONTH_LABELS[pendingMonth]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {Object.entries(MONTH_LABELS).filter(([k]) => k !== "all").map(([num, label]) => (
                  <SelectItem key={num} value={num}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-[120px] flex-1 flex-col gap-1 sm:flex-none">
            <span className="px-1 text-xs text-muted-foreground">Created year</span>
            <Select value={String(pendingYear)} onValueChange={(v) => setPendingYear(v === "all" ? "all" : Number(v))}>
              <SelectTrigger className="w-full bg-card sm:w-28">
                <SelectValue placeholder="Year">{pendingYear === "all" ? "All years" : pendingYear}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button variant={filtersDirty ? "default" : "outline"} size="icon" onClick={handleApplyFilters} disabled={!filtersDirty} aria-label="Apply filters" className="shrink-0">
              <SearchIcon size={16} />
            </Button>
            <Button variant="outline" size="icon" onClick={handleResetFilters} disabled={filtersAtDefault} aria-label="Reset filters" className="shrink-0">
              <Undo2 size={16} />
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Main Church</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="pr-8 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: LIMIT }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell className="pl-4"><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : members.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No one matches these filters right now</TableCell></TableRow>
            ) : (
              members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="pl-4">{m.first_name} {m.last_name}</TableCell>
                  <TableCell>{m.phone_num || "—"}</TableCell>
                  <TableCell className="capitalize">{m.gender}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.connector_first_name ? `${m.connector_first_name} ${m.connector_last_name}` : "—"}
                  </TableCell>
                  <TableCell>{m.main_church || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(m.added_at)}</TableCell>
                  <TableCell className="flex justify-end gap-1 pr-4">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingMember(m)}
                            className="bg-primary/10 hover:bg-primary/20"
                          >
                            <Pencil size={16} className="text-primary" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit details</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setJoinTarget(m)}
                            className="bg-success/10 hover:bg-success/20"
                          >
                            <Home size={16} className="text-success" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Joined a care group</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setRemoveTarget(m)}
                            className="bg-destructive/10 hover:bg-destructive/20"
                          >
                            <Trash2 size={16} className="text-destructive" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Mark removed</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > LIMIT && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total} records
          </p>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1 || loading}>Previous</Button>
            <span className="text-sm font-medium">Page {page} of {Math.ceil(total / LIMIT)}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / LIMIT) || loading}>Next</Button>
          </div>
        </div>
      )}

      <AddConnectMemberModal open={addOpen} onOpenChange={setAddOpen} onSaved={loadMembers} />

      <EditConnectMemberModal
        member={editingMember}
        open={!!editingMember}
        onOpenChange={(o) => !o && setEditingMember(null)}
        onSaved={loadMembers}
      />

      <ArchiveConnectMembersModal open={archiveOpen} onOpenChange={setArchiveOpen} onRestored={loadMembers} />


      <JoinCareGroupModal
        member={joinTarget}
        open={!!joinTarget}
        onOpenChange={(o) => !o && setJoinTarget(null)}
        onSaved={loadMembers}
      />

      {/* remove confirmation: same Dialog shell as the other modals, destructive confirm */}
      <Dialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border py-5 pl-5 pr-12"> {/* pr-12 keeps text clear of the built-in X */}
            <div className="flex items-start gap-4">
              {/* icon badge: destructive-tinted circle, same icon as the row's delete button */}
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <Trash2 size={18} className="text-destructive" />
              </div>
              <div className="space-y-1.5 text-left">
                <DialogTitle>Mark as removed?</DialogTitle>
                <DialogDescription>
                  <span className="font-medium text-foreground">{removeTarget?.first_name} {removeTarget?.last_name}</span> will be dropped from the Connect pipeline.
                  You can restore them from the Archive later.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {/* pinned footer bar, same as the other modals */}
          <DialogFooter className="border-t border-border bg-muted/30 px-5 py-4">
            <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button
              onClick={handleConfirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90" // red confirm for a removal, not the gold primary
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}