'use client';

import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';

interface OnboardingStep {
  title: string;
  description: string;
  icon: string;
  highlight?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Welcome to Builder\'s Circle',
    description: 'A transparent ownership system where your contributions directly translate to influence. Let\'s get you started!',
    icon: '👋',
  },
  {
    title: 'Join a Build Cycle',
    description: 'Build cycles are time-bound periods where you can contribute and earn ownership. Navigate to Build Cycles to opt in.',
    icon: '🚀',
    highlight: 'build-cycles',
  },
  {
    title: 'Submit Activity to Stay Active',
    description: 'Regular contributions keep your participation status active. Submit proof of your work to maintain full ownership influence.',
    icon: '✅',
    highlight: 'activity',
  },
  {
    title: 'Watch Your Participation Health',
    description: 'Your stall stage indicates activity level. Stay active (0-6 days) to maintain your full multiplier and ownership influence.',
    icon: '📊',
    highlight: 'dashboard',
  },
  {
    title: 'Ownership Grows Through Contribution',
    description: 'Every verified contribution adds to your ownership. Track your vested and provisional ownership in the Earnings page.',
    icon: '💎',
    highlight: 'earnings',
  },
];

const STORAGE_KEY = 'builders-circle-onboarding-completed';

interface OnboardingTourProps {
  onComplete?: () => void;
}

export default function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Check if onboarding has been completed
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Show onboarding after a short delay
      const timer = setTimeout(() => setIsOpen(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsOpen(false);
    onComplete?.();
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const step = ONBOARDING_STEPS[currentStep];
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-in fade-in duration-300" />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full animate-in zoom-in-95 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="text-4xl">{step.icon}</div>
              <div>
                <h2 className="text-xl font-semibold text-gray-100">{step.title}</h2>
                <p className="text-sm text-gray-400">
                  Step {currentStep + 1} of {ONBOARDING_STEPS.length}
                </p>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Skip tour"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="px-6 pt-4">
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-gray-300 text-lg leading-relaxed">
              {step.description}
            </p>

            {/* Visual Highlight Hint */}
            {step.highlight && (
              <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                <p className="text-sm text-indigo-400">
                  💡 Look for the <span className="font-semibold">{step.highlight}</span> section in the sidebar
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-800">
            <button
              onClick={handleSkip}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Skip tour
            </button>

            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handlePrevious}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 
                    text-gray-300 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 
                  text-white rounded-lg font-medium transition-colors"
              >
                {currentStep === ONBOARDING_STEPS.length - 1 ? (
                  <>
                    <Check className="w-4 h-4" />
                    Get Started
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-center gap-2 pb-6">
            {ONBOARDING_STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-indigo-600 w-8'
                    : index < currentStep
                    ? 'bg-indigo-600/50'
                    : 'bg-gray-700'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Hook to check if onboarding should be shown
 */
export function useOnboarding() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    setShouldShow(!completed);
  }, []);

  const resetOnboarding = () => {
    localStorage.removeItem(STORAGE_KEY);
    setShouldShow(true);
  };

  return { shouldShow, resetOnboarding };
}
