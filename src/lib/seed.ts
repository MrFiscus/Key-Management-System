import type { Snapshot } from "./types";
import { DEFAULT_PERSON_CATEGORY } from "./types";
import { newId } from "./id";

/**
 * Sample data so the app isn't blank on first run. This is the mock set the
 * Figma prototype shipped with, reshaped into the normalized model. Replace it
 * by importing your real spreadsheet — import wipes all of this.
 */
const ROWS: [
  person: string,
  dept: string,
  building: string,
  roomDesc: string,
  roomNo: string,
  stamp: string,
  issued: string,
  returned: string | null,
  numKeys: number,
][] = [
  ["Marcus Halverson", "Library Services", "Karl E. Mundt Library", "Archives Room", "204", "2A.9", "2023-08-14", null, 1],
  ["Priya Nair", "Chemistry", "Science Center", "Lab Storage Closet", "118", "1C.4", "2024-01-07", null, 2],
  ["Priya Nair", "Chemistry", "Science Center", "Department Office", "101", "1C.1", "2022-09-01", "2024-05-15", 1],
  ["Derek Olson", "Computer Science", "Beadle Hall", "Server Room", "312", "3B.7", "2023-03-20", null, 1],
  ["Sandra Feuerbach", "Registrar", "Administration", "Main Office", "100", "0A.2", "2021-05-10", "2023-12-01", 1],
  ["Sandra Feuerbach", "Registrar", "Administration", "Records Vault", "102B", "0A.5", "2021-05-10", null, 1],
  ["James Thibodeau", "Mathematics", "Beadle Hall", "Faculty Office", "215", "2B.3", "2022-08-22", null, 1],
  ["Kara Elliston", "Library Services", "Karl E. Mundt Library", "Media Lab", "305", "3A.1", "2023-10-02", "2024-04-30", 1],
  ["Marcus Halverson", "Library Services", "Karl E. Mundt Library", "Server Closet", "207", "2A.11", "2024-02-19", null, 1],
  ["Teri Waxman", "Biology", "Science Center", "Greenhouse Access", "G1", "G.2", "2023-06-15", null, 2],
  ["Derek Olson", "Computer Science", "Beadle Hall", "Network Closet", "308", "3B.9", "2023-11-01", "2024-03-15", 1],
  ["Angela Rourke", "Physical Plant", "Facilities", "Equipment Storage", "B10", "B.3", "2020-01-15", null, 3],
  ["Thomas Berglund", "Residence Life", "East Hall", "RA Office", "108", "1E.2", "2024-08-20", null, 1],
  ["Elena Marchetti", "Biology", "Science Center", "Cold Storage Room", "022", "0C.8", "2023-02-11", "2025-01-10", 1],
  ["James Thibodeau", "Mathematics", "Beadle Hall", "Computer Lab", "220", "2B.7", "2024-01-15", null, 1],
  // Same stamp held by two different people at once — the case that broke a
  // stamp-unique schema. Keep at least one of these in the sample data.
  ["Angela Rourke", "Physical Plant", "Facilities", "Custodial Closet", "B12", "B.7", "2022-04-01", null, 1],
  ["Thomas Berglund", "Residence Life", "Facilities", "Custodial Closet", "B12", "B.7", "2024-09-05", null, 1],
];

export function buildSeed(): Snapshot {
  const people = new Map<string, { id: string; dept: string; building: string }>();
  const keys = new Map<string, { id: string }>();
  const snap: Snapshot = { people: [], keys: [], assignments: [] };

  for (const [name, dept, building, roomDesc, roomNo, stamp, issued, returned, numKeys] of ROWS) {
    const personKey = name.toLowerCase();
    if (!people.has(personKey)) {
      const id = newId();
      people.set(personKey, { id, dept, building });
      snap.people.push({
        id,
        fullName: name,
        email: null,
        employeeId: null,
        department: dept,
        building,
        category: DEFAULT_PERSON_CATEGORY,
      });
    }

    const keyKey = `${stamp.toLowerCase()}|${roomNo.toLowerCase()}|${building.toLowerCase()}`;
    if (!keys.has(keyKey)) {
      const id = newId();
      keys.set(keyKey, { id });
      snap.keys.push({
        id,
        keyStamp: stamp,
        roomNumber: roomNo,
        roomDescription: roomDesc,
        building,
        department: dept,
        notes: null,
      });
    }

    snap.assignments.push({
      id: newId(),
      personId: people.get(personKey)!.id,
      keyId: keys.get(keyKey)!.id,
      dateIssued: issued,
      dateReturned: returned,
      numKeys,
      notes: null,
    });
  }

  return snap;
}
