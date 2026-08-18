import { Server, Socket } from 'socket.io';
import { store } from './store';

const RATE_LIMIT_INTERVAL = 50; // 20 votes/sec max per client
const BATCH_INTERVAL = 100;

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

    socket.on('vote', (data: { teacherId: string }) => {
      const now = Date.now();
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
