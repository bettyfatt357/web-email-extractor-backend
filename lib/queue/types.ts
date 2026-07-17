export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: string;
  url: string;
  normalizedUrl?: string; // For deduplication
  status: JobStatus;
  emails: string[];
  retries: number;
  maxRetries: number;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  processingTime?: number; // Duration in ms
  emailsFound?: number; // Count of emails
  error: string | null;
  source?: string; // Where did this job come from?
  query?: string; // Search query if applicable
  domain?: string; // Extracted domain for grouping
  attempts?: number; // Number of extraction attempts
}

export interface QueueConfig {
  redisUrl: string;
  maxRetries?: number;
  jobTimeout?: number; // in ms
}

export interface URLNormalizationOptions {
  removeTrailingSlash?: boolean;
  lowercaseDomain?: boolean;
  removeUtmParams?: boolean;
  normalizeProtocol?: boolean;
}
