'use client';

import React from 'react';
import {
  CheckCircle, Loader2, AlertCircle,
  Brain, Code2, ShieldCheck, TestTube, Eye, Zap,
} from 'lucide-react';

export type PipelineStep =
  | 'idle'
  | 'parsing'
  | 'parsed'
  | 'generating'
  | 'validating'
  | 'testing'
  | 'complete'
  | 'error';

interface Step {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  activeStep: PipelineStep;
  completedSteps: PipelineStep[];
}

interface PipelineStatusProps {
  currentStep: PipelineStep;
  errorMessage?: string;
}

const STEPS: Step[] = [
  {
    id: 'parse',
    label: 'Intent Parser',
    description: 'Converting NL to structured JSON',
    icon: <Brain className="w-4 h-4" />,
    activeStep: 'parsing',
    completedSteps: ['parsed', 'generating', 'validating', 'testing', 'complete'],
  },
  {
    id: 'generate',
    label: 'Code Generator',
    description: 'Building React + TypeScript component',
    icon: <Code2 className="w-4 h-4" />,
    activeStep: 'generating',
    completedSteps: ['validating', 'testing', 'complete'],
  },
  {
    id: 'validate',
    label: 'A11y Validator',
    description: 'Enforcing WCAG 2.1 AA rules',
    icon: <ShieldCheck className="w-4 h-4" />,
    activeStep: 'validating',
    completedSteps: ['testing', 'complete'],
  },
  {
    id: 'test',
    label: 'Test Generator',
    description: 'Creating RTL + Playwright tests',
    icon: <TestTube className="w-4 h-4" />,
    activeStep: 'testing',
    completedSteps: ['complete'],
  },
  {
    id: 'preview',
    label: 'Live Preview',
    description: 'Rendering in Sandpack sandbox',
    icon: <Eye className="w-4 h-4" />,
    activeStep: 'complete',
    completedSteps: [],
  },
];

export default function PipelineStatus({ currentStep, errorMessage }: PipelineStatusProps) {
  if (currentStep === 'idle') return null;

  const getStepState = (step: Step) => {
    if (currentStep === 'error') return 'error';
    if (step.completedSteps.includes(currentStep)) return 'complete';
    if (step.activeStep === currentStep) return 'active';
    return 'pending';
  };

  return (
    <div
      className="w-full rounded-xl border border-gray-700/50 bg-gray-900/60 backdrop-blur-sm p-6"
      role="status"
      aria-label="Component generation pipeline status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 mb-6">
        <Zap className="w-4 h-4 text-blue-400" />
        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
          Generation Pipeline
        </span>
      </div>

      <div className="flex items-start gap-0 relative">
        {/* Connector line */}
        <div
          className="absolute top-5 left-5 h-px bg-gray-700"
          style={{ right: '1.25rem' }}
          aria-hidden="true"
        />

        {STEPS.map((step, index) => {
          const state = getStepState(step);

          return (
            <div
              key={step.id}
              className="flex-1 flex flex-col items-center gap-2 relative"
            >
              {/* Step circle */}
              <div
                className={`
                  relative z-10 w-10 h-10 rounded-full flex items-center justify-center
                  transition-all duration-500
                  ${state === 'complete'
                    ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                    : state === 'active'
                    ? 'bg-blue-500/20 border-2 border-blue-500 text-blue-400 ring-4 ring-blue-500/20'
                    : state === 'error'
                    ? 'bg-red-500/20 border-2 border-red-500 text-red-400'
                    : 'bg-gray-800 border-2 border-gray-600 text-gray-500'
                  }
                `}
                aria-label={`${step.label}: ${state}`}
              >
                {state === 'complete' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : state === 'active' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : state === 'error' && index === STEPS.findIndex(s => s.activeStep === currentStep) ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  step.icon
                )}
              </div>

              {/* Step label */}
              <div className="text-center px-1">
                <p className={`text-xs font-semibold ${
                  state === 'complete' ? 'text-green-400' :
                  state === 'active' ? 'text-blue-400' :
                  state === 'error' ? 'text-red-400' :
                  'text-gray-500'
                }`}>
                  {step.label}
                </p>
                {state === 'active' && (
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-tight max-w-[80px]">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Error message */}
      {currentStep === 'error' && errorMessage && (
        <div
          className="mt-4 p-3 rounded-lg bg-red-950/50 border border-red-500/30 flex items-start gap-2"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
