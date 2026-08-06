import { Teacher, GameStatus } from '../lib/types';

class Store {
  teachers: Teacher[] = [];
  status: GameStatus = 'idle';
  votes: Map<string, number> = new Map();
  votingEndsAt: number | null = null;
  durationMinutes: number = 3;
  connectedClients: number = 0;
  private votingTimer: NodeJS.Timeout | null = null;

  addTeacher(name: string, image: string): Teacher {
    const teacher: Teacher = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name,
      image,
    };
    this.teachers.push(teacher);
    this.votes.set(teacher.id, 0);
    return teacher;
  }

  removeTeacher(id: string): void {
    this.teachers = this.teachers.filter((t) => t.id !== id);
    this.votes.delete(id);
  }

  openVoting(durationMinutes: number, onTimeUp: () => void, keepScores = false): void {
    this.durationMinutes = durationMinutes;
    this.status = 'voting';
    this.votingEndsAt = Date.now() + durationMinutes * 60 * 1000;

    if (!keepScores) {
      for (const t of this.teachers) {
        this.votes.set(t.id, 0);
      }
    }

    this.votingTimer = setTimeout(() => {
      this.closeVoting();
      onTimeUp();
    }, durationMinutes * 60 * 1000);
  }

  closeVoting(): void {
    this.status = 'closed';
    this.votingEndsAt = null;
    if (this.votingTimer) {
      clearTimeout(this.votingTimer);
      this.votingTimer = null;
    }
  }

  addVote(teacherId: string): boolean {
    if (this.status !== 'voting') return false;
    const current = this.votes.get(teacherId);
    if (current === undefined) return false;
    this.votes.set(teacherId, current + 1);
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
