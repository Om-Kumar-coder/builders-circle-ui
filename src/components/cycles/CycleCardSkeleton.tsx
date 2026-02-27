export default function CycleCardSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="h-6 bg-gray-800 rounded w-2/3"></div>
        <div className="h-6 bg-gray-800 rounded w-20"></div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-gray-800 rounded w-24"></div>
          <div className="h-4 bg-gray-800 rounded w-32"></div>
        </div>
        <div className="flex items-center justify-between">
          <div className="h-4 bg-gray-800 rounded w-24"></div>
          <div className="h-4 bg-gray-800 rounded w-32"></div>
        </div>
        <div className="flex items-center justify-between">
          <div className="h-4 bg-gray-800 rounded w-24"></div>
          <div className="h-4 bg-gray-800 rounded w-16"></div>
        </div>
      </div>
    </div>
  );
}
