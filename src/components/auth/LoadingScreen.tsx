import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  color?: string;
}

export default function LoadingScreen({ 
  message = 'Loading...', 
  color = 'text-blue-500' 
}: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className={`w-12 h-12 ${color} animate-spin mx-auto mb-4`} />
        <p className="text-gray-400">{message}</p>
      </div>
    </div>
  );
}
