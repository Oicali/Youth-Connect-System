// crop dialog: round preview, drag + zoom, returns a cropped File via onConfirm
import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog.jsx";
import { getCroppedFile } from "@/lib/cropImage.js";

export function ImageCropDialog({ src, fileName, onCancel, onConfirm }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState(null); // crop rectangle in the original image's pixels
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_, pixels) => setArea(pixels), []);

  const handleConfirm = async () => {
    if (!area) return;
    setSaving(true);
    try {
      const baseName = fileName.replace(/\.[^.]+$/, "") || "photo";
      onConfirm(await getCroppedFile(src, area, `${baseName}.jpg`));
    } catch {
      toast.error("Could not crop the photo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>Crop photo</DialogTitle>
          <DialogDescription>Drag to reposition, use the slider to zoom.</DialogDescription>
        </DialogHeader>

        {/* Cropper fills its parent, so the parent needs an explicit height */}
        <div className="relative h-72 w-full bg-black">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="px-5 py-4">
          <input
            type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="w-full"
          />
        </div>

        <DialogFooter className="border-t border-border bg-muted/30 px-5 py-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="button" onClick={handleConfirm} disabled={!area || saving}>
            {saving ? "Cropping..." : "Use photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}