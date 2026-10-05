// frontend\src\pages\Users.jsx

import { useState, useEffect, useCallback, useRef } from "react";
import { Pencil, Trash2, RotateCcw, Search as SearchIcon, Undo2, Archive } from "lucide-react";

import { fetchUsers, setUserStatus } from "@/lib/api/users";
import { UserPlus } from "lucide-react";
import { useLoadingModal } from "@/context/LoadingModalContext";
import { useAuth } from "@/context/AuthContext";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { UserFormDialog } from "@/components/users/UserFormDialog.jsx";
import { ArchiveUsersModal } from "@/components/users/ArchiveUsersModal.jsx";
import { useErrorModal } from "@/context/ErrorModalContext";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const ROLE_LABELS = { all: "All roles", admin: "Admin", volunteer: "Volunteer" };


export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // pending = what's shown in the controls; committed = what's actually fetched with
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pendingRole, setPendingRole] = useState("all");
  const [role, setRole] = useState("all");
  const status = "active"; // deactivated users live in the Archive modal, not this table

  const [editingUser, setEditingUser] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null); // { user, nextStatus }
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  const { showError } = useErrorModal();
  const { runWithLoading } = useLoadingModal();
  const { user: currentUser } = useAuth();

  // holds the controller of the request currently in flight
  const abortRef = useRef(null);

  const loadUsers = useCallback(async () => {
    // cancel the previous request so only the latest one can update the table
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const { users, total } = await fetchUsers({
        search, role, status, page, limit,
        signal: controller.signal,
      });
      setUsers(users);
      setTotal(total);
    } catch (err) {
      if (err.name === "AbortError") return; // cancelled on purpose, not a real error
      showError(err.message, "Could Not Load Users");
    } finally {
      // an aborted request must not clear loading, since a newer one is still running
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [search, role, status, page]);

  // fetch only runs when search/role/status are committed (via Apply/Enter) or page changes
  useEffect(() => {
    loadUsers();
    return () => abortRef.current?.abort(); // cancel on unmount
  }, [loadUsers]);

  // filters and page are set together, so only one fetch fires
  const handleApplyFilters = () => {
    setSearch(searchInput.trim());
    setRole(pendingRole);
    setPage(1);
  };

  // clear filters and return to page 1 in the same update
  const handleResetFilters = () => {
    setSearchInput("");
    setSearch("");
    setPendingRole("all");
    setRole("all");
    setPage(1);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApplyFilters();
    }
  };

  const filtersDirty =
    searchInput.trim() !== search ||
    pendingRole !== role;

  const filtersAtDefault =
    !searchInput && !search &&
    pendingRole === "all" && role === "all";

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleConfirmStatusChange = async () => {
    if (!confirmTarget) return;
    try {
      await runWithLoading(
        confirmTarget.nextStatus === "deactivated" ? "Deactivating user..." : "Reactivating user...",
        () => setUserStatus(confirmTarget.user.user_id, confirmTarget.nextStatus)
      );
      toast.success(
        confirmTarget.nextStatus === "deactivated"
          ? "User deactivated"
          : "User reactivated",
      );
      setConfirmTarget(null);
      loadUsers();
    } catch (err) {
      showError(err.message, "Could Not Update Status");
    }
  };

  return (
    <div className="space-y-4">
      {/* header: stacked on mobile, side by side from sm up */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage your organization's users and their access
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setArchiveOpen(true)}>
            <Archive size={16} className="mr-2" />
            Archive
          </Button>
          <Button onClick={() => setAddDialogOpen(true)}>
            <UserPlus size={16} className="mr-2" />
            Add user
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[200px] flex-1 flex-col gap-1">
            <span className="px-1 text-xs text-muted-foreground">Search</span>
            <Input
              placeholder="Search name, email, or phone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="bg-card"
            />
          </div>
          <div className="flex min-w-[140px] flex-1 flex-col gap-1 sm:flex-none">
            <span className="px-1 text-xs text-muted-foreground">Role</span>
            <Select value={pendingRole} onValueChange={setPendingRole}>
              <SelectTrigger className="w-full bg-card sm:w-40">
                <SelectValue placeholder="Role">{ROLE_LABELS[pendingRole]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="volunteer">Volunteer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              variant={filtersDirty ? "default" : "outline"}
              size="icon"
              onClick={handleApplyFilters}
              disabled={!filtersDirty}
              aria-label="Apply filters"
              className="shrink-0"
            >
              <SearchIcon size={16} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleResetFilters}
              disabled={filtersAtDefault}
              aria-label="Reset filters"
              className="shrink-0"
            >
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
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="pr-8 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: limit }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell className="pl-4"><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-2">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => {
                const isSelf = u.user_id === currentUser?.user_id;
                return (
                  <TableRow key={u.user_id}>
                    <TableCell className="pl-4">
                      {u.first_name} {u.last_name}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.phone}</TableCell>
                    <TableCell className="capitalize">{u.gender}</TableCell>
                    <TableCell>
                      <Badge
                        className="capitalize"
                        variant={
                          u.role_name === "admin" ? "default" : "secondary"
                        }
                      >
                        {u.role_name}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {formatDate(u.created_at)}
                    </TableCell>
                    {/* row actions with tooltips, same as the other pages */}
                    <TableCell className="flex justify-end gap-1 pr-4">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {/* span wrapper: a disabled button never fires hover, so the tooltip hangs off the span */}
                            <span className="inline-flex">
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isSelf}
                                onClick={() => setEditingUser(u)}
                                className="bg-primary/10 hover:bg-primary/20"
                              >
                                <Pencil size={16} className="text-primary" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isSelf ? "Use Profile settings to edit your own account" : "Edit user"}
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isSelf}
                                onClick={() => setConfirmTarget({ user: u, nextStatus: "deactivated" })}
                                className="bg-destructive/10 hover:bg-destructive/20"
                              >
                                <Trash2 size={16} className="text-destructive" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isSelf ? "You can't deactivate your own account" : "Deactivate user"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => page > 1 && setPage(page - 1)}
                className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <PaginationItem key={p}>
                <PaginationLink
                  isActive={p === page}
                  onClick={() => setPage(p)}
                  className="cursor-pointer"
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => page < totalPages && setPage(page + 1)}
                className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <ArchiveUsersModal
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        onRestored={loadUsers}
      />

      <UserFormDialog
        user={editingUser}
        open={addDialogOpen || !!editingUser}
        onOpenChange={(open) => {
          if (!open) {
            setAddDialogOpen(false);
            setEditingUser(null);
          }
        }}
        onSaved={loadUsers}
      />

      {/* status confirmation: same Dialog shell as the other pages; red for deactivate, green for reactivate */}
      <Dialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border py-5 pl-5 pr-12"> {/* pr-12 keeps text clear of the built-in X */}
            <div className="flex items-start gap-4">
              {/* icon badge: tint follows the action */}
              <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${confirmTarget?.nextStatus === "deactivated" ? "bg-destructive/10" : "bg-success/10"}`}>
                {confirmTarget?.nextStatus === "deactivated"
                  ? <Trash2 size={18} className="text-destructive" />
                  : <RotateCcw size={18} className="text-success" />}
              </div>
              <div className="space-y-1.5 text-left">
                <DialogTitle>
                  {confirmTarget?.nextStatus === "deactivated" ? "Deactivate this user?" : "Reactivate this user?"}
                </DialogTitle>
                {/* header stays one short line, details live in the body below */}
                <DialogDescription>
                  <span className="font-medium text-foreground">{confirmTarget?.user.username}</span>
                  {confirmTarget?.nextStatus === "deactivated" ? " will be deactivated." : " will be reactivated."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="px-5 py-4 text-sm text-muted-foreground">
            {confirmTarget?.nextStatus === "deactivated"
              ? "They will no longer be able to log in. You can reactivate them from the Archive later."
              : "They will be able to log in again."}
          </div>

          <DialogFooter className="border-t border-border bg-muted/30 px-5 py-4">
            <Button type="button" variant="outline" onClick={() => setConfirmTarget(null)}>Cancel</Button>
            <Button
              onClick={handleConfirmStatusChange}
              className={confirmTarget?.nextStatus === "deactivated"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" // red confirm for a deactivation
                : "bg-success text-success-foreground hover:bg-success/90"}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}