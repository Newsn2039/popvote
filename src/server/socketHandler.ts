import { Server, Socket } from 'socket.io';
import { store } from './store';

const RATE_LIMIT_INTERVAL = 50; // 20 votes/sec max per client
const BATCH_INTERVAL = 100;

// Auto-clicker detection settings
const PATTERN_WINDOW = 30; // need 30 samples before judging
const VARIANCE_THRESHOLD = 6; // stddev < 6ms = impossibly consistent = bot
const PENALTY_DURATION = 3000; // block votes for 3 seconds after kick
const MAX_CLICKS_PER_SECOND = 16; // human max ~10-12 taps/sec

function detectAutoClicker(intervals: number[]): boolean {
  if (intervals.length < PATTERN_WINDOW) return false;
  const recent = intervals.slice(-PATTERN_WINDOW);

  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const variance = recent.reduce((sum, v) => sum + (v - avg) ** 2, 0) / recent.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev < VARIANCE_THRESHOLD) return true;

  return false;
}

function detectHighRate(timestamps: number[]): boolean {
  if (timestamps.length < MAX_CLICKS_PER_SECOND) return false;
  const now = timestamps[timestamps.length - 1];
  const oneSecAgo = now - 1000;
  const clicksInLastSec = timestamps.filter(t => t >= oneSecAgo).length;
  return clicksInLastSec > MAX_CLICKS_PER_SECOND;
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
    let lastRawTime = 0;
    const rawIntervals: number[] = [];
    const rawTimestamps: number[] = [];
    let penaltyUntil = 0;

    socket.on('vote', (data: { teacherId: string }) => {
      const now = Date.now();

      // Track RAW timestamps and intervals before rate limit for bot detection
      rawTimestamps.push(now);
      if (rawTimestamps.length > 60) rawTimestamps.shift();

      if (lastRawTime > 0) {
        rawIntervals.push(now - lastRawTime);
        if (rawIntervals.length > 60) rawIntervals.shift();
      }
      lastRawTime = now;

      // Auto-clicker detection: high rate OR consistent pattern
      if (detectHighRate(rawTimestamps) || detectAutoClicker(rawIntervals)) {
        penaltyUntil = now + PENALTY_DURATION;
        rawIntervals.length = 0;
        rawTimestamps.length = 0;
        lastRawTime = 0;
        socket.emit('vote-kick');
        return;
      }

      // Penalty: blocked for cheating
      if (now < penaltyUntil) return;

      // Basic rate limit
      if (now - lastVoteTime < RATE_LIMIT_INTERVAL) return;
      lastVoteTime = now;

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
