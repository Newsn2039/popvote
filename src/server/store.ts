import { Teacher, GameStatus } from '../lib/types';
import fs from 'fs';
import path from 'path';

const SAVE_FILE = path.join(process.cwd(), 'popvote-data.json');
const SAVE_INTERVAL = 2000;

interface SavedData {
  teachers: Teacher[];
  status: GameStatus;
  votes: Record<string, number>;
  votingEndsAt: number | null;
  durationMinutes: number;
}

class Store {
  teachers: Teacher[] = [];
  status: GameStatus = 'idle';
  votes: Map<string, number> = new Map();
  votingEndsAt: number | null = null;
  durationMinutes: number = 3;
  connectedClients: number = 0;
  private votingTimer: NodeJS.Timeout | null = null;
  private saveTimer: NodeJS.Timeout | null = null;
  private dirty = false;

  constructor() {
    this.load();
    this.saveTimer = setInterval(() => {
      if (this.dirty) {
        this.saveToDisk();
        this.dirty = false;
      }
    }, SAVE_INTERVAL);
  }

  private load(): void {
    try {
      if (!fs.existsSync(SAVE_FILE)) return;
      const raw = fs.readFileSync(SAVE_FILE, 'utf-8');
      const data: SavedData = JSON.parse(raw);
      this.teachers = data.teachers || [];
      this.durationMinutes = data.durationMinutes || 3;
      this.votes = new Map(Object.entries(data.votes || {}));

      if (data.status === 'voting' && data.votingEndsAt) {
        const remaining = data.votingEndsAt - Date.now();
        if (remaining > 0) {
          this.status = 'voting';
          this.votingEndsAt = data.votingEndsAt;
        } else {
          this.status = 'closed';
          this.votingEndsAt = null;
        }
      } else {
        this.status = data.status || 'idle';
        this.votingEndsAt = null;
      }
      console.log(`> Loaded saved data: ${this.teachers.length} teachers, status=${this.status}`);
    } catch {
      console.log('> No saved data found, starting fresh');
    }
  }

  private saveToDisk(): void {
    const data: SavedData = {
      teachers: this.teachers,
      status: this.status,
      votes: Object.fromEntries(this.votes),
      votingEndsAt: this.votingEndsAt,
      durationMinutes: this.durationMinutes,
    };
    try {
      fs.writeFileSync(SAVE_FILE, JSON.stringify(data), 'utf-8');
    } catch (e) {
      console.error('> Failed to save data:', e);
    }
  }

  private markDirty(): void {
    this.dirty = true;
  }

  save(): void {
    this.saveToDisk();
    this.dirty = false;
  }

  addTeacher(name: string, image: string): Teacher {
    const teacher: Teacher = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name,
      image,
    };
    this.teachers.push(teacher);
    this.votes.set(teacher.id, 0);
    this.markDirty();
    return teacher;
  }

  removeTeacher(id: string): void {
    this.teachers = this.teachers.filter((t) => t.id !== id);
    this.votes.delete(id);
    this.markDirty();
  }

  openVoting(durationMinutes: number, onTimeUp: () => void, keepScores = false): void {
    this.openVotingSeconds(durationMinutes * 60, onTimeUp, keepScores);
  }

  openVotingSeconds(durationSeconds: number, onTimeUp: () => void, keepScores = false): void {
    this.durationMinutes = Math.ceil(durationSeconds / 60);
    this.status = 'voting';
    this.votingEndsAt = Date.now() + durationSeconds * 1000;

    if (!keepScores) {
      for (const t of this.teachers) {
        this.votes.set(t.id, 0);
      }
    }

    this.votingTimer = setTimeout(() => {
      this.closeVoting();
      onTimeUp();
    }, durationSeconds * 1000);
    this.markDirty();
  }

  resumeVoting(onTimeUp: () => void): boolean {
    if (this.status !== 'voting' || !this.votingEndsAt) return false;
    const remaining = this.votingEndsAt - Date.now();
    if (remaining <= 0) {
      this.closeVoting();
      return false;
    }
    this.votingTimer = setTimeout(() => {
      this.closeVoting();
      onTimeUp();
    }, remaining);
    return true;
  }

  closeVoting(): void {
    this.status = 'closed';
    this.votingEndsAt = null;
    if (this.votingTimer) {
      clearTimeout(this.votingTimer);
      this.votingTimer = null;
    }
    this.markDirty();
  }

  addVote(teacherId: string): boolean {
    if (this.status !== 'voting') return false;
    const current = this.votes.get(teacherId);
    if (current === undefined) return false;
    this.votes.set(teacherId, current + 1);
    this.markDirty();
    return true;
  }

  getRacePositions(): { id: string; progress: number }[] {
    const maxVotes = Math.max(...Array.from(this.votes.values()), 1);
    return this.teachers.map((t) => ({
      id: t.id,
      progress: Math.min(((this.votes.get(t.id) || 0) / maxVotes) * 95, 95),
    }));
  }

  finalize(): { teacher: Teacher; votes: number }[] {
    this.status = 'finalized';
    const rankings = this.teachers
      .map((t) => ({
        teacher: t,
        votes: this.votes.get(t.id) || 0,
      }))
      .sort((a, b) => b.votes - a.votes);
    this.markDirty();
    return rankings;
  }

  reset(): void {
    this.status = 'idle';
    this.votingEndsAt = null;
    if (this.votingTimer) {
      clearTimeout(this.votingTimer);
      this.votingTimer = null;
    }
    for (const t of this.teachers) {
      this.votes.set(t.id, 0);
    }
    this.markDirty();
  }

  getState() {
    return {
      status: this.status,
      teachers: this.teachers,
      votingEndsAt: this.votingEndsAt,
      durationMinutes: this.durationMinutes,
      connectedClients: this.connectedClients,
    };
  }
}

export const store = new Store();
