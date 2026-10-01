// frontend\src\components\ArchiveUsersModal.jsx
import { useState, useEffect, useCallback } from "react";
import { Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { fetchUsers, setUserStatus } from "@/lib/api/users";
import { useErrorModal } from "@/context/ErrorModalContext";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
};

export function ArchiveUsersModal({ open, onOpenChange, onRestored }) {
  const { showError } = useErrorModal();

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
      await setUserStatus(targetUser.user_id, "active");
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive size={18} />
            Deactivated Users
          </DialogTitle>
        </DialogHeader>

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
          className="mb-2"
        />

        {/* fixed-height scroll area: modal keeps its size for skeleton, empty, and data states */}
        <div className="h-[360px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Deactivated On</TableHead>
              <TableHead className="w-0 whitespace-nowrap text-right">Restore</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              // skeleton rows: 4 text cells + the last cell mimics the reactivate button
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 w-full max-w-[120px] animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                  <TableCell>
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
                  <TableCell>{u.first_name} {u.last_name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell className="capitalize">{u.role_name}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(u.updated_at)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex justify-end">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleRestore(u)}
                        disabled={restoringId === u.user_id}
                        aria-label="Reactivate user"
                        className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
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
      </DialogContent>
    </Dialog>
  );
}