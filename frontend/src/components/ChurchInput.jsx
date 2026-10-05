import { useEffect, useId, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { fetchChurches } from "@/lib/api/members";

const MAX_SUGGESTIONS = 5;

// free-text input with suggestions from recorded churches; typing a brand new church always works
export function ChurchInput({ value, onChange }) {
  const listId = useId();
  const [churches, setChurches] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // keyboard/hover highlight, -1 = none

  // fetch once per mount; modal content mounts on open, so every open gets a fresh list
  useEffect(() => {
    let cancelled = false;
    fetchChurches()
      .then(({ churches }) => { if (!cancelled) setChurches(churches); })
      .catch(() => {}); // suggestions are optional, a failure just leaves a plain input
    return () => { cancelled = true; };
  }, []);

  // client-side filter: substring match, prefix matches first, usage order kept within each group
  const suggestions = useMemo(() => {
    const raw = (value || "").trim();
    const q = raw.toLowerCase();
    return churches
      .filter((c) => c.toLowerCase().includes(q) && c !== raw) // "Sm molino" still suggests "SM Molino"; only a character-for-character match hides
      .sort((a, b) => Number(b.toLowerCase().startsWith(q)) - Number(a.toLowerCase().startsWith(q)))
      .slice(0, MAX_SUGGESTIONS);
  }, [churches, value]);

  const showList = open && suggestions.length > 0;

  const pick = (church) => {
    onChange(church);
    setOpen(false);
    setActive(-1);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && showList && active >= 0) {
      e.preventDefault(); // picks the suggestion instead of submitting the form
      pick(suggestions[active]);
    } else if (e.key === "Escape" && showList) {
      e.stopPropagation(); // try to keep the modal open, closes only the list
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <Input
        value={value || ""}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {suggestions.map((church, i) => (
            <li
              key={church}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(church); }} // preventDefault keeps the input focused so blur doesn't kill the click
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer rounded-sm px-2 py-1.5 text-sm ${i === active ? "bg-primary/15 text-primary" : ""}`}
            >
              {church}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}