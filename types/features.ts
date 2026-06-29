import { TaskType } from "@/types/events";

export type TimeWindowFeatures = {
  window_start: string;
  window_end: string;
  work_minutes: number;
  break_minutes: number;
  active_ratio: number;
  transition_count: number;
  interruption_count: number;
  dominant_project?: string;
  dominant_task_type?: TaskType;
  avg_focus?: number;
  avg_energy?: number;
  avg_difficulty?: number;
  focus_score: number;
  fragmentation_score: number;
  recovery_score: number;
};
