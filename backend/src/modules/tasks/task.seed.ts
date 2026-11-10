import { randomUUID } from 'node:crypto';
import type { Task, TaskStatus } from './task.schema';
import { taskSchema } from './task.schema';

interface SeedTask {
  titulo: string;
  descricao: string | null;
  status: TaskStatus;
  /** Relative to "now" so the list always looks fresh when the app boots. */
  minutesAgo: number;
  /**
   * When the task was last edited, also relative to "now". Omitted means "never
   * edited", so `dataAtualizacao` equals `dataCriacao`. Some entries set it far
   * from the creation time on purpose: that is what makes the "recently updated"
   * sort visibly different from the creation order.
   */
  editedMinutesAgo?: number;
}

/**
 * Fictional data only - no real people, clients or systems.
 * Seeded so the reviewer can see pagination, statuses and the infinite scroll
 * working without typing anything first.
 */
const SEED_TASKS: SeedTask[] = [
  {
    titulo: 'Review the Q3 revenue dashboard',
    descricao: 'Check the pipeline chart against the finance spreadsheet before the board meeting.',
    status: 'in_progress',
    minutesAgo: 25,
  },
  {
    titulo: 'Fix timezone bug in the scheduler',
    descricao: 'Recurring events are created one hour off when the account is not in UTC.',
    status: 'todo',
    minutesAgo: 70,
  },
  {
    titulo: 'Write the API contract for the billing service',
    descricao: null,
    status: 'in_progress',
    minutesAgo: 130,
    editedMinutesAgo: 15,
  },
  {
    titulo: 'Pair review on the onboarding funnel',
    descricao: 'Walk through the new funnel events and agree on the naming convention.',
    status: 'done',
    minutesAgo: 190,
  },
  {
    titulo: 'Migrate the legacy export job to the queue',
    descricao: 'The current cron job times out for accounts with more than 50k rows.',
    status: 'todo',
    minutesAgo: 260,
    editedMinutesAgo: 45,
  },
  {
    titulo: 'Add empty states to the campaign list',
    descricao: null,
    status: 'done',
    minutesAgo: 320,
  },
  {
    titulo: 'Benchmark the image resizing worker',
    descricao: 'Compare sharp against the current pipeline on the sample dataset.',
    status: 'todo',
    minutesAgo: 410,
  },
  {
    titulo: 'Document the feature flag rollout process',
    descricao: 'Short guide covering naming, ownership and the rollback checklist.',
    status: 'in_progress',
    minutesAgo: 520,
    editedMinutesAgo: 90,
  },
  {
    titulo: 'Upgrade the analytics SDK',
    descricao: 'The vendor deprecated the v2 client; v3 changes the event payload shape.',
    status: 'todo',
    minutesAgo: 640,
  },
  {
    titulo: 'Prepare the demo environment',
    descricao: 'Reset the sandbox data and seed the fictional catalog for the client workshop.',
    status: 'done',
    minutesAgo: 780,
  },
  {
    titulo: 'Investigate the slow checkout page',
    descricao: 'LCP is around 4.2s on mobile; start with the bundle and the hero image.',
    status: 'in_progress',
    minutesAgo: 900,
    editedMinutesAgo: 120,
  },
  {
    titulo: 'Collect feedback on the new design tokens',
    descricao: null,
    status: 'todo',
    minutesAgo: 1030,
  },
  {
    titulo: 'Harden the CSV import validation',
    descricao: 'Reject rows with duplicated emails instead of silently dropping them.',
    status: 'in_progress',
    minutesAgo: 1180,
    editedMinutesAgo: 200,
  },
  {
    titulo: 'Rotate the staging credentials',
    descricao: 'Stored in the team vault; schedule a short window with the platform squad.',
    status: 'done',
    minutesAgo: 1320,
  },
  {
    titulo: 'Write the ADR for the new cache layer',
    descricao: 'Explain why we chose read-through over write-behind.',
    status: 'todo',
    minutesAgo: 1500,
  },
  {
    titulo: 'Fix the pagination on the audit log',
    descricao: 'The page jumps when a filter is applied after loading page two.',
    status: 'todo',
    minutesAgo: 1710,
    editedMinutesAgo: 300,
  },
  {
    titulo: 'Run the accessibility checklist on the dashboard',
    descricao: 'Keyboard navigation and contrast on the KPI cards.',
    status: 'in_progress',
    minutesAgo: 1920,
  },
  {
    titulo: 'Draft the release notes for the next sprint',
    descricao: null,
    status: 'done',
    minutesAgo: 2160,
  },
  {
    titulo: 'Automate the nightly smoke test',
    descricao: 'Cover login, checkout and the reporting export in a single flow.',
    status: 'todo',
    minutesAgo: 2400,
  },
  {
    titulo: 'Refactor the notification dispatcher',
    descricao: 'Extract the channel selection from the message formatting logic.',
    status: 'todo',
    minutesAgo: 2700,
  },
  {
    titulo: 'Interview a candidate for the platform team',
    descricao: 'Focus on distributed systems and incident response.',
    status: 'done',
    minutesAgo: 3000,
  },
  {
    titulo: 'Review the data retention policy',
    descricao: 'Confirm the anonymisation window with legal before the audit.',
    status: 'in_progress',
    minutesAgo: 3300,
    editedMinutesAgo: 1500,
  },
  {
    titulo: 'Set up alerts for the payment webhook',
    descricao: 'Page on call when the failure rate passes 2% for five minutes.',
    status: 'todo',
    minutesAgo: 3600,
  },
  {
    titulo: 'Clean up the deprecated REST endpoints',
    descricao: 'No traffic in the last 30 days according to the gateway metrics.',
    status: 'done',
    minutesAgo: 4000,
    editedMinutesAgo: 600,
  },
];

/**
 * Parsed through the entity schema on purpose: seed data is hand-written, so a
 * typo here fails at boot instead of leaking an invalid task to the repository.
 */
export function buildSeedTasks(now: Date = new Date()): Task[] {
  const tasks = SEED_TASKS.map(({ titulo, descricao, status, minutesAgo, editedMinutesAgo }) => ({
    id: randomUUID(),
    titulo,
    descricao,
    status,
    dataCriacao: new Date(now.getTime() - minutesAgo * 60_000),
    dataAtualizacao: new Date(now.getTime() - (editedMinutesAgo ?? minutesAgo) * 60_000),
  }));

  return taskSchema.array().parse(tasks);
}
