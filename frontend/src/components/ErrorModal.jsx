// frontend\src\components\ErrorModal.jsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export function ErrorModal({ open, title, message, onClose }) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className= "sm:max-w-[425px] pt-12">
        <DialogHeader className="items-center">
          <AlertCircle className="h-10 w-10 text-destructive mb-2" />
          <DialogTitle className="text-destructive text-2xl text-center">{title}</DialogTitle>
          <DialogDescription className="text-center text-foreground/80">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}