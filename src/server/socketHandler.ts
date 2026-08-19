import { Server, Socket } from 'socket.io';
import { store } from './store';

const RATE_LIMIT_INTERVAL = 50; // 20 votes/sec max per client
const BATCH_INTERVAL = 100;

// Auto-clicker detection settings
const PATTERN_WINDOW = 20; // check last 20 intervals
const VARIANCE_THRESHOLD = 15; // if std deviation < 15ms = too consistent = bot
const PENALTY_DURATION = 3000; // block votes for 3 seconds after kick
const MAX_VOTES_PER_SECOND = 15; // sustained cap

function detectAutoClicker(intervals: number[]): boolean {
  if (intervals.length < PATTERN_WINDOW) return false;
  const recent = intervals.slice(-PATTERN_WINDOW);

  // Check 1: variance too low = auto-clicker (humans are inconsistent)
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const variance = recent.reduce((sum, v) => sum + (v - avg) ** 2, 0) / recent.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev < VARIANCE_THRESHOLD) return true;

  // Check 2: sustained high rate for too long (humans slow down)
  const avgInterval = avg;
  if (avgInterval < 70 && intervals.length > 40) return true;

  return false;
}

export function setupSocketHandlers(io: Server) {
  let batchTimer: NodeJS.Timeout | null = null;
  let dirty = false;

  function broadcastRaceUpdate() {
    io.emit('race-update', { positions: store.getRacePositions() });
  }

  function startBatchBroadcast() {
    if (batchTimer) return;
    batchTimer = setInterval(() => {
      if (dirty) {
        broadcastRaceUpdate();
        dirty = false;
      }
    }, BATCH_INTERVAL);
  }

  function stopBatchBroadcast() {
    if (batchTimer) {
      clearInterval(batchTimer);
      batchTimer = null;
    }
  }

  function broadcastState() {
    io.emit('state-update', store.getState());
  }

  function broadcastConnectedCount() {
    io.emit('connected-count', { count: store.connectedClients });
  }

  // Resume voting timer if server restarted mid-vote
  if (store.status === 'voting') {
    const resumed = store.resumeVoting(() => {
      stopBatchBroadcast();
      io.emit('vote-closed');
      broadcastState();
    });
    if (resumed) {
      startBatchBroadcast();
      console.log('> Resumed voting timer from saved state');
    }
  }

  io.on('connection', (socket: Socket) => {
    store.connectedClients++;
    broadcastConnectedCount();

    socket.emit('state-update', store.getState());
    if (store.status === 'voting') {
      socket.emit('race-update', { positions: store.getRacePositions() });
    }

    let lastVoteTime = 0;
    const intervals: number[] = [];
    let penaltyUntil = 0;
    let votesThisSecond = 0;
    let secondStart = 0;

    socket.on('vote', (data: { teacherId: string }) => {
      const now = Date.now();

      // Penalty: blocked for cheating
      if (now < penaltyUntil) return;

      // Basic rate limit
      if (now - lastVoteTime < RATE_LIMIT_INTERVAL) return;

      // Per-second cap
      if (now - secondStart > 1000) {
        votesThisSecond = 0;
        secondStart = now;
      }
      votesThisSecond++;
      if (votesThisSecond > MAX_VOTES_PER_SECOND) return;

      // Track intervals for pattern detection
      if (lastVoteTime > 0) {
        intervals.push(now - lastVoteTime);
        if (intervals.length > 60) intervals.shift();
      }
      lastVoteTime = now;

      // Auto-clicker detection
      if (detectAutoClicker(intervals)) {
        penaltyUntil = now + PENALTY_DURATION;
        intervals.length = 0;
        socket.emit('vote-kick');
        return;
      }

      if (store.addVote(data.teacherId)) {
        dirty = true;
      }
    });

    socket.on('admin:add-teacher', (data: { name: string; image: string }) => {
      store.addTeacher(data.name, data.image);
      broadcastState();
    });

    socket.on('admin:remove-teacher', (data: { teacherId: string }) => {
      store.removeTeacher(data.teacherId);
      broadcastState();
    });

    socket.on('admin:open-vote', (data: { durationSeconds?: number; durationMinutes?: number; keepScores?: boolean }) => {
      const seconds = data.durationSeconds ?? (data.durationMinutes ?? 3) * 60;
      store.openVotingSeconds(seconds, () => {
        stopBatchBroadcast();
        io.emit('vote-closed');
        broadcastState();
      }, data.keepScores || false);
      startBatchBroadcast();
      io.emit('vote-opened', { endsAt: store.votingEndsAt });
      broadcastState();
      broadcastRaceUpdate();
    });

    socket.on('admin:close-vote', () => {
      store.closeVoting();
      stopBatchBroadcast();
      io.emit('vote-closed');
      broadcastState();
    });

    socket.on('admin:finalize', () => {
      const rankings = store.finalize();
      io.emit('results', { rankings });
      broadcastState();
      broadcastRaceUpdate();
    });

    socket.on('admin:reset', () => {
      store.reset();
      stopBatchBroadcast();
      broadcastState();
    });

    socket.on('disconnect', () => {
      store.connectedClients--;
      broadcastConnectedCount();
    });
  });
}
