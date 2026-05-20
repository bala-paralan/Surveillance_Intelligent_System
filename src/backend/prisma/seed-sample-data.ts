/**
 * Sample-data seed for staging — creates a handful of alerts + incidents
 * the operator console can render. Idempotent: skips records whose IDs
 * already exist.
 *
 * Run: npx tsx prisma/seed-sample-data.ts
 */
import { PrismaClient, type AlertType, type AlertSeverity, type IncidentStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface SampleAlert {
  id:       string;
  type:     AlertType;
  severity: AlertSeverity;
  message:  string;
  bopZoneId: string | null;
  createdAtOffsetMs: number; // negative = past
}

interface SampleIncident {
  id:        string;
  title:     string;
  severity:  AlertSeverity;
  status:    IncidentStatus;
  bopZoneId: string | null;
  responder: string;
  createdBy: string;
  openedAtOffsetMs: number;
  alertIds:  string[];
}

const SECTORS = {
  NW_04: 'NW-04',
  N_12:  'N-12',
  NE_07: 'NE-07',
  E_22:  'E-22',
};

const SAMPLE_ALERTS: SampleAlert[] = [
  { id: 'seed_alt_001', type: 'PERSON',    severity: 'CRITICAL', bopZoneId: SECTORS.E_22,  message: 'Group crossing — Cedar Crossing (5 individuals)',            createdAtOffsetMs: -2  * 60 * 1000 },
  { id: 'seed_alt_002', type: 'PERSON',    severity: 'HIGH',     bopZoneId: SECTORS.NW_04, message: 'Person detected at CAM-04-12',                                createdAtOffsetMs: -5  * 60 * 1000 },
  { id: 'seed_alt_003', type: 'VEHICLE',   severity: 'HIGH',     bopZoneId: SECTORS.NW_04, message: 'Vehicle near fence at CAM-04-08',                             createdAtOffsetMs: -11 * 60 * 1000 },
  { id: 'seed_alt_004', type: 'MOTION',    severity: 'LOW',      bopZoneId: SECTORS.N_12,  message: 'Wildlife motion at CAM-12-03',                                createdAtOffsetMs: -14 * 60 * 1000 },
  { id: 'seed_alt_005', type: 'ACOUSTIC',  severity: 'CRITICAL', bopZoneId: SECTORS.NW_04, message: 'Tunnel acoustic signature — Pinegate (seismic + sub-bass)',   createdAtOffsetMs: -49 * 60 * 1000 },
  { id: 'seed_alt_006', type: 'INTRUSION', severity: 'MEDIUM',   bopZoneId: SECTORS.NE_07, message: 'Drone overflight — Saltflats',                                createdAtOffsetMs: -24 * 60 * 1000 },
  { id: 'seed_alt_007', type: 'SYSTEM',    severity: 'LOW',      bopZoneId: null,          message: 'CAM-07-02 reconnected after 47s offline',                     createdAtOffsetMs: -38 * 60 * 1000 },
  { id: 'seed_alt_008', type: 'SEISMIC',   severity: 'MEDIUM',   bopZoneId: SECTORS.E_22,  message: 'Footstep cluster detected by SEIS-22-04',                     createdAtOffsetMs: -7  * 60 * 1000 },
];

const SAMPLE_INCIDENTS: SampleIncident[] = [
  {
    id:        'seed_inc_001',
    title:     'Group crossing — Cedar Crossing',
    severity:  'CRITICAL',
    status:    'IN_PROGRESS',
    bopZoneId: SECTORS.E_22,
    responder: 'Patrol Bravo-2',
    createdBy: 'seed',
    openedAtOffsetMs: -4 * 60 * 1000,
    alertIds:  ['seed_alt_001', 'seed_alt_008'],
  },
  {
    id:        'seed_inc_002',
    title:     'Drone overflight — Saltflats',
    severity:  'HIGH',
    status:    'INVESTIGATING',
    bopZoneId: SECTORS.NE_07,
    responder: 'Air Unit-1',
    createdBy: 'seed',
    openedAtOffsetMs: -24 * 60 * 1000,
    alertIds:  ['seed_alt_006'],
  },
  {
    id:        'seed_inc_003',
    title:     'Tunnel acoustic — Pinegate',
    severity:  'CRITICAL',
    status:    'ESCALATED',
    bopZoneId: SECTORS.NW_04,
    responder: 'Eng. Crew-3',
    createdBy: 'seed',
    openedAtOffsetMs: -49 * 60 * 1000,
    alertIds:  ['seed_alt_005'],
  },
];

const main = async (): Promise<void> => {
  const now = Date.now();

  for (const a of SAMPLE_ALERTS) {
    const existing = await prisma.alert.findUnique({ where: { id: a.id } });
    if (existing) {
      console.log(`alert ${a.id} already exists — skipped`);
      continue;
    }
    await prisma.alert.create({
      data: {
        id:        a.id,
        type:      a.type,
        severity:  a.severity,
        bopZoneId: a.bopZoneId,
        message:   a.message,
        createdAt: new Date(now + a.createdAtOffsetMs),
      },
    });
    console.log(`✓ alert  ${a.id} (${a.severity} ${a.type})`);
  }

  for (const i of SAMPLE_INCIDENTS) {
    const existing = await prisma.incident.findUnique({ where: { id: i.id } });
    if (existing) {
      console.log(`incident ${i.id} already exists — skipped`);
      continue;
    }
    await prisma.incident.create({
      data: {
        id:        i.id,
        title:     i.title,
        severity:  i.severity,
        status:    i.status,
        bopZoneId: i.bopZoneId,
        responder: i.responder,
        createdBy: i.createdBy,
        openedAt:  new Date(now + i.openedAtOffsetMs),
        alerts:    { connect: i.alertIds.map((id) => ({ id })) },
      },
    });
    console.log(`✓ incident ${i.id} (${i.status} ${i.severity}) linked to ${i.alertIds.length} alerts`);
  }

  console.log('\nDone. Seeded:', SAMPLE_ALERTS.length, 'alerts +', SAMPLE_INCIDENTS.length, 'incidents.');
};

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => void prisma.$disconnect());
