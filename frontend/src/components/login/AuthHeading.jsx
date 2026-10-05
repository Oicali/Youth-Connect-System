// frontend/src/components/AuthHeading.jsx
// page title + subtitle shown under the logo
export function AuthHeading({ title, subtitle }) {
  return (
    <div className="-mt-4 mb-12 text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}