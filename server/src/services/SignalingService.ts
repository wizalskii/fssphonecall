import { Server as SocketIOServer } from 'socket.io';
import type { WebRTCSignal, ICECandidateData } from '@fssphone/shared';

export class SignalingService {
  constructor(private io: SocketIOServer) {}

  relayOffer(data: WebRTCSignal): void {
    console.log(`Relaying offer from ${data.from} to ${data.to}`);
    this.io.to(data.to).emit('webrtc:offer', data);
  }

  relayAnswer(data: WebRTCSignal): void {
    console.log(`Relaying answer from ${data.from} to ${data.to}`);
    this.io.to(data.to).emit('webrtc:answer', data);
  }

  relayICECandidate(data: ICECandidateData): void {
    console.log(`Relaying ICE candidate from ${data.from} to ${data.to}`);
    this.io.to(data.to).emit('webrtc:ice-candidate', data);
  }
}
