// frontend/src/components/ArchiveUsersModal.jsx
import { useState, useEffect, useCallback } from "react";
import { Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { fetchUsers, setUserStatus } from "@/lib/api/users.js";
import { useErrorModal } from "@/context/ErrorModalContext.jsx";
import { useLoadingModal } from "@/context/LoadingModalContext.jsx";

import { Input } from "@/components/ui/input.jsx";
import { Button } from "@/components/ui/button.jsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog.jsx";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table.jsx";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
};

export function ArchiveUsersModal({ open, onOpenChange, onRestored }) {
  const { showError } = useErrorModal();
const { runWithLoading } = useLoadingModal();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [restoringId, setRestoringId] = useState(null);

  const loadDeactivated = useCallback(async () => {
    setLoading(true);
    try {
      const { users } = await fetchUsers({ status: "deactivated", search, limit: 100 });
      setUsers(users);
    } catch (err) {
      showError(err.message, "Could Not Load Archive");
    } finally {
      setLoading(false);
    }
  }, [search, showError]);

  useEffect(() => {
    if (!open) return;
    setSearchInput("");
    setSearch("");
  }, [open]);

  useEffect(() => {
    if (open) loadDeactivated();
  }, [search, loadDeactivated, open]);

  const handleRestore = async (targetUser) => {
    setRestoringId(targetUser.user_id);
    try {
      await runWithLoading("Reactivating user...", () =>
  setUserStatus(targetUser.user_id, "active"),
);
      toast.success(`${targetUser.first_name} reactivated`);
      setUsers((prev) => prev.filter((u) => u.user_id !== targetUser.user_id));
      onRestored?.();
    } catch (err) {
      showError(err.message, "Could Not Reactivate User");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* same shell as the other archives: p-0 + flex-col so header and footer are pinned bars */}
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border py-5 pl-5 pr-12"> {/* pr-12 keeps text clear of the built-in X */}
          <div className="flex items-start gap-4">
            {/* icon badge: muted circle, no action color to match here */}
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <Archive size={18} className="text-muted-foreground" />
            </div>
            <div className="space-y-1.5 text-left">
              <DialogTitle>Deactivated Users</DialogTitle>
              <DialogDescription>
                Deactivated users can't log in. Reactivating restores their access.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 px-7 py-5">
          <Input
            placeholder="Search deactivated users..."
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
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Deactivated On</TableHead>
                  <TableHead className="w-0 whitespace-nowrap pr-4 text-right">Restore</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  // skeleton rows: 4 text cells + the last cell mimics the reactivate button
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
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-[280px] text-center align-middle text-muted-foreground">
                      No deactivated users
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="pl-4">{u.first_name} {u.last_name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell className="capitalize">{u.role_name}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(u.updated_at)}</TableCell>
                      <TableCell className="whitespace-nowrap pr-4">
                        <div className="flex justify-end">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => handleRestore(u)}
                            disabled={restoringId === u.user_id}
                            aria-label="Reactivate user"
                            className="border-success text-success hover:bg-success hover:text-success-foreground" // theme tokens instead of hardcoded green-600
                          >
                            <RotateCcw size={16} />
                          </Button>
                        </div>
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
            {loading ? "Loading..." : `${users.length} deactivated user${users.length === 1 ? "" : "s"}`}
          </span>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}