// frontend/src/components/PhoneInput.jsx
import { Input } from "@/components/ui/input.jsx";

// paste only: +63917..., 0917..., 917... all reduce to the 9 digits after "09"
const pasteToLocal = (raw) => {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("63")) d = "0" + d.slice(2);
  else if (d.length === 10 && d.startsWith("9")) d = "0" + d;
  if (d.length > 9 && d.startsWith("09")) d = d.slice(2); // only strip the prefix from full-length pastes
  return d.slice(0, 9);
};

// display only: 244840227 -> "244 840 227"; stored value stays raw digits
const groupDigits = (d) => d.replace(/(\d{3})(?=\d)/g, "$1 ");

// fixed "09" prefix + 9 typed digits; value/onChange use the full 09XXXXXXXXX string ("" when empty)
export function PhoneInput({ value, onChange, disabled, invalid }) {
  const local = (value || "").slice(2);
  const emit = (digits) => onChange(digits ? `09${digits}` : "");

  // input-group: wrapper owns border/ring/states, prefix is a fixed cell, input is borderless
  return (
    <label
      className={`flex h-9 w-full items-center overflow-hidden rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] dark:bg-input/30
        focus-within:ring-[3px]
        ${invalid
          ? "border-destructive focus-within:ring-destructive/20"
          : "border-input focus-within:border-ring focus-within:ring-ring/50"}
        ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {/* fixed prefix cell: same size classes as the input text */}
      <span className="flex h-full select-none items-center border-r border-input bg-muted/40 px-3 text-base tabular-nums text-muted-foreground md:text-sm">
        09
      </span>
      {/* borderless input; shows grouped digits, emits raw digits */}
      <Input
        className="h-full flex-1 rounded-none border-0 bg-transparent px-3 tabular-nums shadow-none focus-visible:ring-0 disabled:opacity-100 dark:bg-transparent md:text-sm"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={11} // 9 digits + 2 display spaces
        placeholder="XXX XXX XXX"
        value={groupDigits(local)}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(e) => emit(e.target.value.replace(/\D/g, "").slice(0, 9))}
        onPaste={(e) => {
          e.preventDefault();
          emit(pasteToLocal(e.clipboardData.getData("text")));
        }}
      />
    </label>
  );
}