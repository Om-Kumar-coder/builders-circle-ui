import TriageSubmissionForm from '@/components/triage/TriageSubmissionForm';

export default function SubmitToTriagePage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Apply to Builder's Circle</h1>
          <p className="text-gray-400">Submit your application and we'll review it shortly.</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <TriageSubmissionForm />
        </div>
      </div>
    </div>
  );
}
