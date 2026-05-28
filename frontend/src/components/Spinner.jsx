export default function Spinner({ label }) {
  return (
    <div className="text-center py-6">
      <div className="flex justify-center gap-1.5 mb-2">
        {[0, 150, 300].map((d) => (
          <span key={d} className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
