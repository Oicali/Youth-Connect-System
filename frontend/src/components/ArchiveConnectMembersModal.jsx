// frontend\src\components\ArchiveConnectMembersModal.jsx

import { useState, useEffect, useCallback } from "react";
import { Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { fetchMembers, unassignConnector } from "@/lib/api/members";
import { useErrorModal } from "@/context/ErrorModalContext";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

export function ArchiveConnectMembersModal({ open, onOpenChange, onRestored }) {
  const { showError } = useErrorModal();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [restoringId, setRestoringId] = useState(null);

  const loadArchived = useCallback(async () => {
    setLoading(true);
    try {
      const { members } = await fetchMembers({ connectionStatus: "removed", search, limit: 100 });
      setMembers(members);
    } catch (err) {
      showError(err.message, "Could Not Load Connect Archive");
    } finally {
      setLoading(false);
    }
  }, [search, showError]);

  useEffect(() => {
    if (!open) return;
    setSearchInput("");
    setSearch("");
    loadArchived();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) loadArchived();
  }, [search, loadArchived, open]);

  const handleRestore = async (member) => {
    setRestoringId(member.id);
    try {
      await unassignConnector(member.id); // clears assigned_to, sets connection_status back to 'pending'
      toast.success(`${member.first_name} restored to pending`);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      onRestored?.();
    } catch (err) {
      showError(err.message, "Could Not Restore Member");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* same shell as Add/Edit: p-0 + flex-col so header and footer are pinned bars */}
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
                <DialogHeader className="border-b border-border py-5 pl-5 pr-12"> {/* pr-12 keeps text clear of the built-in X */}
          <div className="flex items-start gap-4">
            {/* icon badge: muted circle, no action color to match here */}
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <Archive size={18} className="text-muted-foreground" />
            </div>
            <div className="space-y-1.5 text-left">
              <DialogTitle>Removed From Connect</DialogTitle>
              <DialogDescription>
                First-timers dropped from follow-up. Restoring sends them back to pending.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 px-7 py-5">
          <Input
            placeholder="Search removed first-timers..."
            value={searchInput}
            onChange={(e) => {
              const value = e.target.value;
              setSearchInput(value);
              if (value.trim() === "") setSearch("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); setSearch(searchInput.trim()); }
            }}
          />

          {/* fixed-height scroll area inside a bordered box: modal keeps its size for skeleton, empty, and data states */}
          <div className="h-[360px] overflow-y-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Main Church</TableHead>
                  <TableHead>Removed On</TableHead>
                  <TableHead className="w-0 pr-4 text-right">Restore</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  // skeleton rows: 4 text cells + the last cell mimics the restore button
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <TableCell key={j} className={j === 0 ? "pl-4" : undefined}>
                          <div className="h-4 w-full max-w-[120px] animate-pulse rounded bg-muted" />
                        </TableCell>
                      ))}
                      <TableCell className="pr-4">
                        <div className="ml-auto h-9 w-9 animate-pulse rounded-md bg-muted" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : members.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-[280px] text-center align-middle text-muted-foreground">No removed first-timers</TableCell></TableRow>
                ) : (
                  members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="pl-4">{m.first_name} {m.last_name}</TableCell>
                      <TableCell>{m.phone_num}</TableCell>
                      <TableCell>{m.main_church || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(m.updated_at)}</TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleRestore(m)}
                          disabled={restoringId === m.id}
                          aria-label="Restore to pending"
                          className="border-success text-success hover:bg-success hover:text-success-foreground" // theme tokens instead of hardcoded green-600
                        >
                          <RotateCcw size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* pinned footer bar: result count on the left, Close on the right */}
        <DialogFooter className="items-center border-t border-border bg-muted/30 px-7 py-4 sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {loading ? "Loading..." : `${members.length} removed first-timer${members.length === 1 ? "" : "s"}`}
          </span>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}