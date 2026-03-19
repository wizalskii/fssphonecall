export interface Call {
  id: string;
  pilotId: string;
  pilotCid: string;        // VATSIM CID of the pilot
  pilotCallsign: string;
  controllerId: string;
  status: 'ringing' | 'active' | 'ended';
  createdAt: number;
}

export interface CallInitiation {
  controllerId: string;
  pilotCallsign: string;
}
