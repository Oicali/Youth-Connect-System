// frontend\src\components\PhotoPicker.jsx
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.jsx";
import { MemberAvatar } from "@/components/MemberAvatar.jsx";
import { ImageCropDialog } from "@/components/ImageCropDialog.jsx"; // crop step before the file reaches the parent

const MAX_BYTES = 10 * 1024 * 1024; // matches the multer cap on the backend
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]; 

export function PhotoPicker({
  currentUrl,
  file,
  removed = false,
  onFileChange,
  onRemoveExisting,
  firstName,
  lastName,
}) {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [crop, setCrop] = useState(null); // { src, name } while the crop dialog is open

  // object URL created inside the effect so React StrictMode's double-run doesn't leave a revoked URL
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shownUrl = previewUrl || (removed ? null : currentUrl);
  const hasPhoto = !!file || (!!currentUrl && !removed);

  const handlePick = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = ""; // lets the same file be picked again after an undo
    if (!picked) return;
       if (!ALLOWED_TYPES.includes(picked.type))
      return toast.error("Please choose a JPG, PNG, or WebP image");
    if (picked.size > MAX_BYTES)
      return toast.error("Photo must be 10 MB or smaller");
    setCrop({ src: URL.createObjectURL(picked), name: picked.name }); // crop first, parent gets the result
  };

  // closes the crop dialog and frees its object URL
  const closeCrop = () => {
    if (crop) URL.revokeObjectURL(crop.src);
    setCrop(null);
  };

  return (
    <div className="flex items-center gap-4">
      <MemberAvatar
        url={shownUrl}
        firstName={firstName}
        lastName={lastName}
        previewable
        className="size-20 text-lg"
      />
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            {hasPhoto ? "Change photo" : "Choose photo"}
          </Button>
          {hasPhoto && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => (file ? onFileChange(null) : onRemoveExisting?.())}
            >
              {file ? "Undo" : "Remove"}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Optional. Resized and compressed automatically.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          className="hidden"
          onChange={handlePick}
        />
        {/* crop dialog: mounts only while a file is being cropped */}
        {crop && (
          <ImageCropDialog
            src={crop.src}
            fileName={crop.name}
            onCancel={closeCrop}
            onConfirm={(cropped) => { onFileChange(cropped); closeCrop(); }}
          />
        )}
      </div>
    </div>
  );
}
