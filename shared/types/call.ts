export interface Call {
  id: string;
  pilotId: string;
  pilotCallsign: string;
  controllerId: string;
  status: 'ringing' | 'active' | 'ended';
  createdAt: number;
}

export interface CallInitiation {
  controllerId: string;
  pilotCallsign: string;
}
