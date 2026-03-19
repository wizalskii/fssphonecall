import type { Controller, ControllerRegistration } from './controller';
import type { Call, CallInitiation } from './call';

export interface WebRTCSignal {
  callId: string;
  from: string;
  to: string;
  sdp: { type: string; sdp?: string };
}

export interface ICECandidateData {
  callId: string;
  from: string;
  to: string;
  candidate: { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null; usernameFragment?: string | null };
}

export interface WsMessage<T extends string = string, P = unknown> {
  type: T;
  payload?: P;
}

export type ClientMessage =
  | WsMessage<'controller:register', ControllerRegistration>
  | WsMessage<'controller:unregister'>
  | WsMessage<'call:initiate', CallInitiation>
  | WsMessage<'call:answer', { callId: string }>
  | WsMessage<'call:reject', { callId: string }>
  | WsMessage<'call:hangup', { callId: string }>
  | WsMessage<'webrtc:offer', WebRTCSignal>
  | WsMessage<'webrtc:answer', WebRTCSignal>
  | WsMessage<'webrtc:ice-candidate', ICECandidateData>;

export type ServerMessage =
  | WsMessage<'controllers:list', Controller[]>
  | WsMessage<'controller:updated', Controller>
  | WsMessage<'controller:removed', { controllerId: string }>
  | WsMessage<'call:incoming', Call>
  | WsMessage<'call:ringing', Call>
  | WsMessage<'call:established', Call>
  | WsMessage<'call:ended', { callId: string; reason?: string }>
  | WsMessage<'webrtc:offer', WebRTCSignal>
  | WsMessage<'webrtc:answer', WebRTCSignal>
  | WsMessage<'webrtc:ice-candidate', ICECandidateData>
  | WsMessage<'error', { message: string }>
  | WsMessage<'welcome', { connectionId: string }>;
