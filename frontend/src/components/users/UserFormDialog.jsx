// frontend/src/components/UserFormDialog.jsx
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { UserPlus, Pencil, Eye, EyeOff } from "lucide-react";

import { addUserSchema, editUserSchema } from "@/lib/validations/user.js";
import { createUser, updateUser } from "@/lib/api/users.js";
import { useErrorModal } from "@/context/ErrorModalContext.jsx";
import { useLoadingModal } from "@/context/LoadingModalContext.jsx";

import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.jsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog.jsx";

const emptyDefaults = {
  username: "", password: "", confirmPassword: "",
  first_name: "", last_name: "", middle_name: "", suffix: "",
  email: "", phone: "", alt_phone: "", gender: "", role_id: "",
};

// explicit trigger labels — Radix SelectValue won't resolve text for values set via reset()/setValue()
const ROLE_LABELS = { "1": "Admin", "2": "Volunteer" };
const GENDER_LABELS_FORM = { male: "Male", female: "Female" };

// password input with its own show/hide toggle; register props pass straight through
const PasswordInput = (props) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className="pr-10" {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-primary"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
};

export function UserFormDialog({ user, open, onOpenChange, onSaved }) {
  const isEdit = !!user;
  const { showError } = useErrorModal();
const { runWithLoading } = useLoadingModal();


  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(isEdit ? editUserSchema : addUserSchema),
    defaultValues: emptyDefaults,
  });

  // Re-populate whenever the target user or open-state changes, so switching
  // between "add" and "edit" (or between two different users) always starts clean.
  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      reset({
        ...emptyDefaults,
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        middle_name: user.middle_name || "",
        suffix: user.suffix || "",
        email: user.email || "",
        phone: user.phone || "",
        alt_phone: user.alt_phone || "",
        gender: user.gender || "",
        role_id: String(user.role_id),
      });
    } else {
      reset(emptyDefaults);
    }
  }, [user, open, isEdit, reset]);

  const onSubmit = async (data) => {
    const { confirmPassword, ...payload } = data;
    try {
      if (isEdit) {
        await runWithLoading("Saving user...", () =>
          updateUser(user.user_id, { ...payload, role_id: Number(payload.role_id) }),
        );
        toast.success("User updated");
      } else {
        await runWithLoading("Creating user...", () =>
          createUser({ ...payload, role_id: Number(payload.role_id) }),
        );
        toast.success("User created");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      showError(err.message, isEdit ? "Could Not Update User" : "Could Not Create User");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* p-0 + flex-col: header and footer are pinned bars, only the form body scrolls */}
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[820px]">
        <DialogHeader className="border-b border-border px-5 py-5">
          <div className="flex items-start gap-4">
            {/* icon badge: primary-tinted circle, icon matches the Add / Edit buttons */}
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              {isEdit ? <Pencil size={18} className="text-primary" /> : <UserPlus size={18} className="text-primary" />}
            </div>
            <div className="space-y-1.5 text-left">
              <DialogTitle>{isEdit ? `Edit User` : "Add New User"}</DialogTitle>
              <DialogDescription>
                {isEdit ? "Update account details and role." : "Create an account for an admin or volunteer."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
          {/* scrollable body: 1 column on mobile, 3 columns on sm+ */}
          <div className="grid flex-1 grid-cols-1 content-start gap-4 overflow-y-auto px-7 py-5 sm:grid-cols-3">
            {/* section: Account */}
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground after:h-px after:flex-1 after:bg-border after:content-[''] sm:col-span-3">
              Account
            </div>
            {/* username + passwords only exist when creating a user */}
            {!isEdit && (
              <>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input {...register("username")} />
                  {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <PasswordInput {...register("password")} />
                  {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Confirm password</Label>
                  <PasswordInput {...register("confirmPassword")} />
                  {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
                </div>
              </>
            )}
            <div className="space-y-2 sm:col-start-1">
              <Label>Role</Label>
              <Select value={watch("role_id")} onValueChange={(v) => setValue("role_id", v, { shouldValidate: true })}>
                <SelectTrigger className="w-full"> {/* fill the grid cell like the inputs */}
                  <SelectValue placeholder="Select role">{ROLE_LABELS[watch("role_id")]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Admin</SelectItem>
                  <SelectItem value="2">Volunteer</SelectItem>
                </SelectContent>
              </Select>
              {errors.role_id && <p className="text-sm text-destructive">{errors.role_id.message}</p>}
            </div>

            {/* section: Personal */}
            <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground after:h-px after:flex-1 after:bg-border after:content-[''] sm:col-span-3">
              Personal
            </div>
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
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={watch("gender")} onValueChange={(v) => setValue("gender", v, { shouldValidate: true })}>
                <SelectTrigger className="w-full"> {/* fill the grid cell like the inputs */}
                  <SelectValue placeholder="Select gender">{GENDER_LABELS_FORM[watch("gender")]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
              {errors.gender && <p className="text-sm text-destructive">{errors.gender.message}</p>}
            </div>


            {/* section: Contact */}
            <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground after:h-px after:flex-1 after:bg-border after:content-[''] sm:col-span-3">
              Contact
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input placeholder="09XX XXX XXXX" {...register("phone")} />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Alt phone</Label>
              <Input {...register("alt_phone")} />
              {errors.alt_phone && <p className="text-sm text-destructive">{errors.alt_phone.message}</p>}
            </div>
          </div>

          {/* pinned footer bar, outside the scrolling body */}
          <DialogFooter className="border-t bg-muted/30 px-7 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? (isEdit ? "Saving..." : "Creating...")
                : (isEdit ? "Save changes" : "Create user")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}