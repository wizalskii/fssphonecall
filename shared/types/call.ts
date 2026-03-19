export interface Call {
  id: string;
  pilotConnectionId: string;
  pilotCid: string;
  pilotCallsign: string;
  controllerId: string;
  controllerConnectionId: string;
  status: 'ringing' | 'active' | 'ended';
  createdAt: number;
}

export interface CallInitiation {
  controllerId: string;
  pilotCallsign: string;
}
