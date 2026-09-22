// Shared DTO types — safe to import from client and server code.
import type { ExerciseKey, Reps } from "./exercises";
import type { Gender } from "./progression";

export interface MemberDTO {
  id: string;
  name: string;
  avatarUrl: string | null;
  gender: Gender;
  /** Exercises in the member's current routine (3–7). */
  activeCount: number;
  /** Highest exercise count ever unlocked — never goes down. */
  highestUnlocked: number;
  statusId: string;
  /** Set when last month's result unlocked a new exercise. */
  unlock: { month: string; statusId: string; activeCount: number } | null;
}

export interface RecordDTO extends Reps {
  memberId: string;
  date: string;
}

export interface BoardMemberDTO extends MemberDTO {
  reps: Reps;
}

export interface BoardDTO {
  members: MemberDTO[];
  records: RecordDTO[];
  /** Full days this calendar month for the signed-in member's routine. */
  myFullDays: number;
}

export interface LeaderboardRowDTO {
  memberId: string;
  name: string;
  avatarUrl: string | null;
  gender: Gender;
  statusId: string;
  activeCount: number;
  daysCompleted: number;
  totalReps: number;
  complete: boolean;
  /** Reps per exercise across the selected period. */
  reps: Reps;
  /** Days each exercise reached 100+. */
  full: Record<ExerciseKey, number>;
  /** Days each exercise landed in 50–99. */
  half: Record<ExerciseKey, number>;
}
