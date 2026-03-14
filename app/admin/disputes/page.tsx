'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { 
  Scale, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  XCircle,
  ExternalLink,
  MessageSquare,
  AlertTriangle
} from 'lucide-react';

interface Dispute {
  id: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
  activity: {
    id: string;
    activityType: string;
    description: string;
    proofLink: string;
    status: string;
  };
}

export default function AdminDisputesPage() {
  const { user, loading: authLoading } = useAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [resolution, setResolution] = useState('');
  const [resolutionStatus, setResolutionStatus] = useState<'approved' | 'denied'>('approved');
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'founder';

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getDisputes();
      setDisputes(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch disputes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchDisputes();
    }
  }, [isAdmin]);

  const handleResolveDispute = async () => {
    if (!selectedDispute || !resolution.trim()) {
      alert('Please provide a resolution');
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.resolveDispute(
        selectedDispute.id,
        resolutionStatus,
        resolution
      );

      alert('Dispute resolved successfully!');
      setShowResolutionModal(false);
      setSelectedDispute(null);
      setResolution('');
      fetchDisputes(); // Refresh data
    } catch (err) {
      alert(`Failed to resolve dispute: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openResolutionModal = (dispute: Dispute) => {
    setSelectedDispute(dispute);
    setResolution('');
    setResolutionStatus('approved');
    setShowResolutionModal(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'denied':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'approved':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'denied':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const pendingDisputes = disputes.filter(d => d.status === 'pending');
  const resolvedDisputes = disputes.filter(d => d.status !== 'pending');

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!isAdmin) {
    return (
      <MainLayout title="Dispute Resolution">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-400">Access denied. Admin privileges required.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Dispute Resolution">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
              <Scale className="w-8 h-8 text-blue-500" />
              Dispute Resolution
            </h1>
            <p className="text-gray-400 mt-1">
              Review and resolve user disputes about activity verification and governance decisions
            </p>
          </div>
          <button
            onClick={fetchDisputes}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 
              border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Pending Disputes</p>
                <p className="text-2xl font-bold text-yellow-400">{pendingDisputes.length}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Disputes</p>
                <p className="text-2xl font-bold text-gray-100">{disputes.length}</p>
              </div>
              <Scale className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Resolution Rate</p>
                <p className="text-2xl font-bold text-green-400">
                  {disputes.length > 0 ? Math.round((resolvedDisputes.length / disputes.length) * 100) : 0}%
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Pending Disputes */}
        {pendingDisputes.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              Pending Disputes ({pendingDisputes.length})
            </h2>
            {pendingDisputes.map((dispute) => (
              <div key={dispute.id} className="bg-gray-900 border border-yellow-500/30 rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(dispute.status)}`}>
                        {getStatusIcon(dispute.status)}
                        <span className="ml-2">{dispute.status}</span>
                      </span>
                      <span className="text-sm text-gray-400">
                        {new Date(dispute.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-medium text-gray-100 mb-2">Dispute Details</h3>
                        <p className="text-gray-300 mb-3">{dispute.reason}</p>
                        <div className="text-sm text-gray-400">
                          <p><strong>User:</strong> {dispute.user.name || dispute.user.email}</p>
                          <p><strong>Submitted:</strong> {new Date(dispute.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-medium text-gray-100 mb-2">Related Activity</h3>
                        <div className="bg-gray-800 rounded-lg p-4">
                          <p className="text-sm font-medium text-gray-200 mb-2">
                            {dispute.activity.activityType} - {dispute.activity.status}
                          </p>
                          <p className="text-sm text-gray-400 mb-3">
                            {dispute.activity.description}
                          </p>
                          <a
                            href={dispute.activity.proofLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
                          >
                            View Proof <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => openResolutionModal(dispute)}
                    className="ml-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg 
                      font-medium transition-colors flex items-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Resolved Disputes */}
        {resolvedDisputes.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-100">
              Resolved Disputes ({resolvedDisputes.length})
            </h2>
            {resolvedDisputes.map((dispute) => (
              <div key={dispute.id} className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(dispute.status)}`}>
                        {getStatusIcon(dispute.status)}
                        <span className="ml-2">{dispute.status}</span>
                      </span>
                      <span className="text-sm text-gray-400">
                        Resolved {dispute.resolvedAt ? new Date(dispute.resolvedAt).toLocaleDateString() : 'Unknown'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-gray-200 mb-2">Original Dispute</h4>
                        <p className="text-gray-400 text-sm mb-2">{dispute.reason}</p>
                        <p className="text-xs text-gray-500">
                          By {dispute.user.name || dispute.user.email}
                        </p>
                      </div>
                      
                      {dispute.resolution && (
                        <div>
                          <h4 className="font-medium text-gray-200 mb-2">Admin Resolution</h4>
                          <p className="text-gray-400 text-sm">{dispute.resolution}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : disputes.length === 0 ? (
          <div className="text-center py-12">
            <Scale className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-300 mb-2">No Disputes</h3>
            <p className="text-gray-400">No disputes have been submitted yet.</p>
          </div>
        ) : null}
      </div>

      {/* Resolution Modal */}
      {showResolutionModal && selectedDispute && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-800">
              <h3 className="text-xl font-semibold text-gray-100">Resolve Dispute</h3>
              <p className="text-gray-400 text-sm mt-1">
                Dispute by {selectedDispute.user.name || selectedDispute.user.email}
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Dispute Details */}
              <div>
                <h4 className="font-medium text-gray-200 mb-2">Dispute Reason</h4>
                <p className="text-gray-300 bg-gray-800 rounded-lg p-3">
                  {selectedDispute.reason}
                </p>
              </div>

              {/* Activity Details */}
              <div>
                <h4 className="font-medium text-gray-200 mb-2">Related Activity</h4>
                <div className="bg-gray-800 rounded-lg p-4 space-y-2">
                  <p className="text-sm"><strong>Type:</strong> {selectedDispute.activity.activityType}</p>
                  <p className="text-sm"><strong>Status:</strong> {selectedDispute.activity.status}</p>
                  <p className="text-sm"><strong>Description:</strong> {selectedDispute.activity.description}</p>
                  <a
                    href={selectedDispute.activity.proofLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    View Proof <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Resolution */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Resolution Decision
                </label>
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="resolution"
                      value="approved"
                      checked={resolutionStatus === 'approved'}
                      onChange={(e) => setResolutionStatus(e.target.value as 'approved' | 'denied')}
                      className="mr-2"
                    />
                    <span className="text-green-400">Approve (User is correct)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="resolution"
                      value="denied"
                      checked={resolutionStatus === 'denied'}
                      onChange={(e) => setResolutionStatus(e.target.value as 'approved' | 'denied')}
                      className="mr-2"
                    />
                    <span className="text-red-400">Deny (Original decision stands)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Resolution Explanation *
                </label>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg 
                    text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-32 resize-none"
                  placeholder="Explain your decision and any actions taken..."
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800">
              <button
                onClick={() => setShowResolutionModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveDispute}
                disabled={submitting || !resolution.trim()}
                className={`px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  resolutionStatus === 'approved' 
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {submitting ? 'Resolving...' : `${resolutionStatus === 'approved' ? 'Approve' : 'Deny'} Dispute`}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}