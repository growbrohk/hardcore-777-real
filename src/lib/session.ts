// Client-side session storage. Only read/write inside effects or event
// handlers — never during SSR.
import type { MemberDTO } from "./hardcore.types";

export type SessionMember = MemberDTO;

export interface StoredSession {
  token: string;
  member: SessionMember;
}

const KEY = "hardcore777_session_v1";

export function getStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.token || !parsed.member?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeSession(session: StoredSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // storage full/blocked — session just won't persist
  }
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
