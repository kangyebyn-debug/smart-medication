export default function Spinner({ label }) {
  return (
    <div role="status" className="py-6 text-center">
      <div aria-hidden="true" className="mb-3 flex justify-center gap-1.5">
        {[0, 150, 300].map((d) => (
          <span key={d} className="h-2 w-2 rounded-full bg-brand motion-safe:animate-pulse" style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
      <p className="break-keep text-base text-muted">{label}</p>
    </div>
  );
}
