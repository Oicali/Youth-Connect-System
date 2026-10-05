// frontend\src\components\MemberAvatar.jsx
// avatar: skeleton while the image loads, initials fallback, optional click-to-preview
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function MemberAvatar({ url, firstName, lastName, className = "size-8", previewable = false }) {
  // tracked per-URL instead of reset in an effect: a new url is automatically "not loaded / not broken"
  const [loadedUrl, setLoadedUrl] = useState(null);
  const [brokenUrl, setBrokenUrl] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const loaded = loadedUrl === url;
  const broken = brokenUrl === url;
  const initials = `${(firstName || "").trim()[0] || ""}${(lastName || "").trim()[0] || ""}`.toUpperCase();
  const fullName = `${firstName || ""} ${lastName || ""}`.trim();

  if (url && !broken) {
    // skeleton sits behind the image; image fades in on load
    const avatar = (
      <span className={`${className} relative block shrink-0`}>
        {!loaded && <Skeleton className="absolute inset-0 rounded-full" />}
        <img
          src={url}
          alt=""
          onLoad={() => setLoadedUrl(url)}
          onError={() => setBrokenUrl(url)}
          className={`size-full rounded-full object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      </span>
    );

    if (!previewable) return avatar;

    return (
      <>
        {/* type="button" so it never submits the surrounding form */}
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          aria-label={`View ${fullName || "member"} photo`}
          className="shrink-0 cursor-zoom-in rounded-full"
        >
          {avatar}
        </button>
        {/* preview dialog: large, uncropped-by-circle view of the same image */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
         
          <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg [&>button]:size-9 [&>button]:rounded-full [&>button]:bg-black/60 [&>button]:text-white [&>button]:opacity-100 [&>button]:backdrop-blur-sm [&>button]:hover:bg-black/80 [&>button]:hover:text-white">
            <DialogTitle className="sr-only">{fullName || "Member"} photo</DialogTitle>
            <img src={url} alt={fullName} className="max-h-[80vh] w-full object-contain" />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className={`${className} flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary`}>
      {initials || "Image"}
    </div>
  );
}