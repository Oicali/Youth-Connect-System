// frontend\src\components\ArchiveMemberModal.jsx
import { useState, useEffect, useCallback } from "react";
import { Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { fetchMembers, setMemberStatus } from "@/lib/api/members";
import { useErrorModal } from "@/context/ErrorModalContext";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";

const RESTORE_STATUS_LABELS = {
  mentee: "Mentee",
  "potential mentor": "Potential Mentor",
  mentor: "Mentor",
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
};

export function ArchiveMembersModal({ open, onOpenChange, onRestored }) {
  const { showError } = useErrorModal();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // per-row pending restore target — defaults to "mentee" since it's the
  // only restore path that never triggers the mentor-demotion cascade
  const [restoreTargets, setRestoreTargets] = useState({});
  const [restoringId, setRestoringId] = useState(null);

  const loadArchived = useCallback(async () => {
    setLoading(true);
    try {
      const { members } = await fetchMembers({ role: ["removed"], search, limit: 100 });
      setMembers(members);
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
    loadArchived();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) loadArchived();
  }, [search, loadArchived, open]);

  const handleRestore = async (member) => {
    const targetStatus = restoreTargets[member.id] || "mentee";
    setRestoringId(member.id);
    try {
      await setMemberStatus(member.id, targetStatus);
      toast.success(`${member.first_name} restored as ${RESTORE_STATUS_LABELS[targetStatus]}`);
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive size={18} />
            Archived Members
          </DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Search archived members..."
          value={searchInput}
          onChange={(e) => {
            const value = e.target.value;
            setSearchInput(value);
            // clearing the field should immediately show all archived members again,
            // not wait for Enter — only Enter still applies a non-empty search term
            if (value.trim() === "") setSearch("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); setSearch(searchInput.trim()); }
          }}
          className="mb-2"
        />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Main Church</TableHead>
              <TableHead>Removed On</TableHead>
              <TableHead className="w-0 whitespace-nowrap text-left">Restore as</TableHead>
              
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No archived members
                </TableCell>
              </TableRow>
            ) : (
              members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.first_name} {m.last_name}</TableCell>
                  <TableCell>{m.phone_num}</TableCell>
                  <TableCell>{m.main_church || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(m.updated_at)}</TableCell>
                                    <TableCell className="whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                    <Select
                      value={restoreTargets[m.id] || "mentee"}
                      onValueChange={(v) => setRestoreTargets((prev) => ({ ...prev, [m.id]: v }))}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue>
                          {RESTORE_STATUS_LABELS[restoreTargets[m.id] || "mentee"]}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mentee">Mentee</SelectItem>
                        <SelectItem value="potential mentor">Potential Mentor</SelectItem>
                        <SelectItem value="mentor">Mentor</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleRestore(m)}
                      disabled={restoringId === m.id}
                      aria-label="Restore member"
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
      </DialogContent>
    </Dialog>
  );
}