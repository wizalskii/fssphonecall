import { Controller, ControllerRegistration } from './controller';
import { Call, CallInitiation } from './call';

// Client to Server Events
export interface ClientToServerEvents {
  'controller:register': (data: ControllerRegistration) => void;
  'controller:unregister': () => void;
  'call:initiate': (data: CallInitiation) => void;
  'call:answer': (callId: string) => void;
  'call:reject': (callId: string) => void;
  'call:hangup': (callId: string) => void;
  'webrtc:offer': (data: WebRTCSignal) => void;
  'webrtc:answer': (data: WebRTCSignal) => void;
  'webrtc:ice-candidate': (data: ICECandidateData) => void;
}

// Server to Client Events
export interface ServerToClientEvents {
  'controllers:list': (controllers: Controller[]) => void;
  'controller:updated': (controller: Controller) => void;
  'controller:removed': (controllerId: string) => void;
  'call:incoming': (call: Call) => void;
  'call:ringing': (call: Call) => void;
  'call:established': (call: Call) => void;
  'call:ended': (callId: string, reason?: string) => void;
  'webrtc:offer': (data: WebRTCSignal) => void;
  'webrtc:answer': (data: WebRTCSignal) => void;
  'webrtc:ice-candidate': (data: ICECandidateData) => void;
  'error': (message: string) => void;
}

// WebRTC Signal Data
export interface WebRTCSignal {
  callId: string;
  from: string;
  to: string;
  sdp: RTCSessionDescriptionInit;
}

export interface ICECandidateData {
  callId: string;
  from: string;
  to: string;
  candidate: RTCIceCandidateInit;
}
