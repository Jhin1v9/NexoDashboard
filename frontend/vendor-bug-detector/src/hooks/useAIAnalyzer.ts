/**
 * Hook useAIAnalyzer
 * Análise de bugs com IA em componentes React
 */

import { useState, useCallback, useRef } from 'react';
import { AIAnalyzer } from '../devtools';
import type { AIAnalysis, InspectedElement, ConsoleLog, NetworkRequest } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReactModule = any;

interface UseAIAnalyzerOptions {
  apiKey: string;
  provider: 'gemini' | 'deepseek' | 'openai';
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface UseAIAnalyzerReturn {
  analysis: AIAnalysis | null;
  isAnalyzing: boolean;
  error: Error | null;
  analyze: (data: {
    element: InspectedElement;
    description: string;
    expectedBehavior?: string;
    consoleLogs?: ConsoleLog[];
    networkRequests?: NetworkRequest[];
    screenshot?: string;
  }) => Promise<AIAnalysis | null>;
  clear: () => void;
}

export function useAIAnalyzer(options: UseAIAnalyzerOptions): UseAIAnalyzerReturn {
  const { apiKey, provider, model, temperature, maxTokens } = options;

  const analyzerRef = useRef<AIAnalyzer | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Inicializa o analisador
  if (!analyzerRef.current) {
    analyzerRef.current = new AIAnalyzer({
      apiKey,
      provider,
      model,
      temperature,
      maxTokens,
    });
  }

  const analyze = useCallback(async (data: {
    element: InspectedElement;
    description: string;
    expectedBehavior?: string;
    consoleLogs?: ConsoleLog[];
    networkRequests?: NetworkRequest[];
    screenshot?: string;
  }): Promise<AIAnalysis | null> => {
    if (!analyzerRef.current) return null;

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await analyzerRef.current.analyze(data);
      setAnalysis(result);
      return result;
    } catch (err) {
      const analyzeError = err instanceof Error ? err : new Error('Failed to analyze');
      setError(analyzeError);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const clear = useCallback(() => {
    setAnalysis(null);
    setError(null);
  }, []);

  return {
    analysis,
    isAnalyzing,
    error,
    analyze,
    clear,
  };
}

export default useAIAnalyzer;
