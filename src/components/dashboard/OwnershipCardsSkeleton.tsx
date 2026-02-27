export default function OwnershipCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-gray-900 rounded-2xl p-6 border border-gray-800 animate-pulse"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="h-4 bg-gray-800 rounded w-24" />
            <div className="w-9 h-9 bg-gray-800 rounded-lg" />
          </div>
          <div className="space-y-2">
            <div className="h-8 bg-gray-800 rounded w-16" />
            <div className="h-3 bg-gray-800 rounded w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
