// frontend\src\pages\Users.jsx

import { useState, useEffect, useCallback } from "react";
import { Pencil, Trash2, RotateCcw, Search as SearchIcon, Undo2 } from "lucide-react";

import { fetchUsers, setUserStatus } from "@/lib/api/users";
import { UserPlus } from "lucide-react";
import { useLoadingModal } from "@/context/LoadingModalContext";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { AddUserDialog } from "@/components/AddUserDialog";
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { EditUserDialog } from "@/components/EditUserDialog";

const ROLE_LABELS = { all: "All roles", admin: "Admin", volunteer: "Volunteer" };
const STATUS_LABELS = { all: "All statuses", active: "Active", deactivated: "Deactivated" };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // pending = what's shown in the controls; committed = what's actually fetched with
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pendingRole, setPendingRole] = useState("all");
  const [role, setRole] = useState("all");
  const [pendingStatus, setPendingStatus] = useState("all");
  const [status, setStatus] = useState("all");

  const [editingUser, setEditingUser] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null); // { user, nextStatus }
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;

  const { showError } = useErrorModal();
  const { runWithLoading } = useLoadingModal();

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { users, total } = await runWithLoading("Searching users...", () =>
        fetchUsers({ search, role, status, page, limit })
      );
      setUsers(users);
      setTotal(total);
    } catch (err) {
      showError(err.message, "Could Not Load Users");
    } finally {
      setLoading(false);
    }
  }, [search, role, status, page]);

  // fetch only runs when search/role/status are committed (via Apply/Enter) or page changes
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // reset to page 1 whenever a committed filter changes, so you don't get stranded on an empty page
  useEffect(() => {
    setPage(1);
  }, [search, role, status]);

  const handleApplyFilters = () => {
    setSearch(searchInput.trim());
    setRole(pendingRole);
    setStatus(pendingStatus);
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setSearch("");
    setPendingRole("all");
    setRole("all");
    setPendingStatus("all");
    setStatus("all");
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApplyFilters();
    }
  };

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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage your organization's users and their access
          </p>
        </div>

        <Button onClick={() => setAddDialogOpen(true)}>
          <UserPlus size={16} className="mr-2" />
          Add user
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[200px] flex-1 flex-col gap-1">
            <span className="px-1 text-xs text-muted-foreground">Search</span>
            <Input
              placeholder="Search name, username, or email..."
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
          <div className="flex min-w-[140px] flex-1 flex-col gap-1 sm:flex-none">
            <span className="px-1 text-xs text-muted-foreground">Status</span>
            <Select value={pendingStatus} onValueChange={setPendingStatus}>
              <SelectTrigger className="w-full bg-card sm:w-40"><SelectValue placeholder="Status">{STATUS_LABELS[pendingStatus]}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="deactivated">Deactivated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={handleApplyFilters} aria-label="Apply filters" className="shrink-0">
              <SearchIcon size={16} />
            </Button>
            <Button variant="outline" size="icon" onClick={handleResetFilters} aria-label="Reset filters" className="shrink-0">
              <Undo2 size={16} />
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground"
                >
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell>
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
                  <TableCell>
                    <Badge
                      className="capitalize"
                      variant={
                        u.status === "active" ? "success" : "destructive"
                      }
                    >
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(u.created_at)}
                  </TableCell>
                  <TableCell className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingUser(u)}
                    >
                      <Pencil size={16} />
                    </Button>
                    {u.status === "deactivated" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setConfirmTarget({ user: u, nextStatus: "active" })
                        }
                      >
                        <RotateCcw size={16} className="text-green-600" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setConfirmTarget({
                            user: u,
                            nextStatus: "deactivated",
                          })
                        }
                      >
                        <Trash2 size={16} className="text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
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

      <AddUserDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onCreated={loadUsers}
      />

      <EditUserDialog
        user={editingUser}
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        onSaved={loadUsers}
      />

      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmTarget?.nextStatus === "deactivated"
                ? "Deactivate this user?"
                : "Reactivate this user?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget?.nextStatus === "deactivated"
                ? `${confirmTarget?.user.username} will no longer be able to log in. You can reactivate them later.`
                : `${confirmTarget?.user.username} will be able to log in again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmStatusChange}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}