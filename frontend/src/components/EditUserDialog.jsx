import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { updateUser } from "@/lib/api/users";
import { useErrorModal } from "@/context/ErrorModalContext";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const editUserSchema = z
  .object({
    first_name: z.string().min(1, "Required"),
    last_name: z.string().min(1, "Required"),
    middle_name: z.string().optional().or(z.literal("")),
    suffix: z.string().optional().or(z.literal("")),
    email: z.string().email("Invalid email"),
    phone: z.string().min(1, "Required"),
    alt_phone: z.string().optional().or(z.literal("")),
    gender: z.string().min(1, "Required"),
    birthdate: z.string().min(1, "Required"),
    role_id: z.string().min(1, "Required"),
  })
  .refine((data) => !data.alt_phone || data.alt_phone !== data.phone, {
    message: "Alternate phone must be different from phone",
    path: ["alt_phone"],
  });

export function EditUserDialog({ user, open, onOpenChange, onSaved }) {
  const { showError } = useErrorModal();

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(editUserSchema) });

  useEffect(() => {
    if (user) {
      reset({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        middle_name: user.middle_name || "",
        suffix: user.suffix || "",
        email: user.email || "",
        phone: user.phone || "",
        alt_phone: user.alt_phone || "",
        gender: user.gender || "",
        birthdate: user.birthdate ? user.birthdate.split("T")[0] : "",
        role_id: String(user.role_id),
      });
    }
  }, [user, reset]);

  const onSubmit = async (data) => {
    try {
      await updateUser(user.user_id, { ...data, role_id: Number(data.role_id) });
      toast.success("User updated");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      showError(err.message, "Could Not Update User");
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {user.username}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First name</Label>
              <Input {...register("first_name")} />
              {errors.first_name && <p className="text-sm text-destructive">{errors.first_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Last name</Label>
              <Input {...register("last_name")} />
              {errors.last_name && <p className="text-sm text-destructive">{errors.last_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Middle name</Label>
              <Input {...register("middle_name")} />
            </div>
            <div className="space-y-2">
              <Label>Suffix</Label>
              <Input {...register("suffix")} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Email</Label>
              <Input type="email" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input {...register("phone")} />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Alt phone</Label>
              <Input {...register("alt_phone")} />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={watch("gender")} onValueChange={(v) => setValue("gender", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Birthdate</Label>
              <Input type="date" {...register("birthdate")} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Role</Label>
              <Select value={watch("role_id")} onValueChange={(v) => setValue("role_id", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Admin</SelectItem>
                  <SelectItem value="2">Volunteer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}