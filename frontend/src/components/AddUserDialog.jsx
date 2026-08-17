import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { addUserSchema } from "@/lib/validations/addUser";
import { createUser } from "@/lib/api/users";
import { useErrorModal } from "@/context/ErrorModalContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const defaultValues = {
  username: "", password: "", confirmPassword: "",
  first_name: "", last_name: "", middle_name: "", suffix: "",
  email: "", phone: "", alt_phone: "", gender: "", birthdate: "", role_id: "",
};

export function AddUserDialog({ open, onOpenChange, onCreated }) {
  const { showError } = useErrorModal();

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(addUserSchema), defaultValues });

  const onSubmit = async (data) => {
    const { confirmPassword, ...payload } = data;
    try {
      await createUser({ ...payload, role_id: Number(payload.role_id) });
      toast.success("User created");
      reset(defaultValues);
      onCreated();
      onOpenChange(false);
    } catch (err) {
      showError(err.message, "Could Not Create User");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add new user</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input {...register("username")} />
              {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={watch("role_id")} onValueChange={(v) => setValue("role_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Admin</SelectItem>
                  <SelectItem value="2">Volunteer</SelectItem>
                </SelectContent>
              </Select>
              {errors.role_id && <p className="text-sm text-destructive">{errors.role_id.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" {...register("password")} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Confirm password</Label>
              <Input type="password" {...register("confirmPassword")} />
              {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
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
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
              {errors.gender && <p className="text-sm text-destructive">{errors.gender.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Birthdate</Label>
              <Input type="date" {...register("birthdate")} />
              {errors.birthdate && <p className="text-sm text-destructive">{errors.birthdate.message}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}