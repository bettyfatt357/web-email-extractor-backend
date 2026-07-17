import { useEffect, useState } from 'react';

interface Usage {
  quotaUsed: number;
  quotaLimit: number;
  quotaRemaining: number;
  plan: string;
  resetDate: string;
}

export function useUsage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsage() {
      try {
        // Browser automatically includes httpOnly cookies in request
        const response = await fetch('/api/billing/status', {
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
        setUsage(data);
        setError(null);
      } catch (err) {
        let message = 'Failed to fetch usage';
        if (err instanceof Error) {
          message = err.message;
        }
        setError(message);
        console.error('[useUsage] Error fetching usage:', message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUsage();
    const interval = setInterval(fetchUsage, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  return { usage, isLoading, error };
}
