// scrolls the first visible field error into view; used as handleSubmit's onInvalid
export function scrollToFirstError(event) {
  // small delay: errors render on the next React commit, not when onInvalid fires
  setTimeout(() => {
    const root = event?.target ?? document; // event.target is the <form>, so it stays scoped to that modal
    const el = root.querySelector("p.text-destructive");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 50);
}