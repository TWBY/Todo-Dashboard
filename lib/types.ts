export interface ProjectChild {
  name: string;
  description: string;
  devPort?: number;
  devCommand?: string;
  devBasePath?: string;
  devAddedAt?: string;
  framework?: 'html' | 'python' | 'swift' | 'other';
}

export interface Project {
  id: string;
  productId: string;
  name: string;
  displayName?: string;
  path: string;
  devPath?: string;
  description: string;
  techStack: string[];
  url?: string;
  children?: ProjectChild[];
  group?: string;
  groupDescription?: string;
  createdAt: string;
  updatedAt: string;
  // Dev server settings
  devPort?: number;
  devCommand?: string;
  devBasePath?: string;
  devAddedAt?: string;
  // Framework type (default: nextjs if not specified)
  framework?: 'html' | 'python' | 'swift' | 'other';
}

// Claude Usage Limits (from Anthropic OAuth API)
export interface UsageBucket {
  utilization: number; // percentage (0-100)
  resets_at: string | null; // ISO datetime
}

export interface ExtraUsage {
  is_enabled: boolean;
  monthly_limit: number | null;
  used_credits: number | null;
  utilization: number | null;
}

export interface ClaudeUsageLimits {
  five_hour: UsageBucket;
  seven_day: UsageBucket;
  seven_day_sonnet: UsageBucket | null;
  seven_day_opus: UsageBucket | null;
  seven_day_oauth_apps: UsageBucket | null;
  seven_day_cowork: UsageBucket | null;
  extra_usage: ExtraUsage;
}

export interface Todo {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  completedAt?: string;
}

export interface ScratchItem {
  id: string;
  title?: string;
  content: string;
  category?: 'bug' | 'task' | 'note' | 'decision';
  source?: 'ai' | 'user';
  done: boolean;
  createdAt: string;
  chatSessionId?: string;
  plan?: string;
  projectId?: string;
  projectName?: string;
  resolvedSessionId?: string;
}