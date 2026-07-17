import { useEffect, useState } from 'react';

interface Metrics {
  activeJobs: number;
  completedJobs: number;
  totalEmails: number;
  totalSearches: number;
}

export function useMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        // Browser automatically includes httpOnly cookies in request
        const response = await fetch('/api/metrics', {
          method: 'GET',
          credentials: 'include', // Send cookies with request
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        setMetrics(data);
        setError(null);
      } catch (err) {
        let message = 'Failed to fetch metrics';
        if (err instanceof Error) {
          message = err.message;
        }
        setError(message);
        console.error('[useMetrics] Error fetching metrics:', message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return { metrics, isLoading, error };
}
