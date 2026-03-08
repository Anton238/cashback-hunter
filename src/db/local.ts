import Dexie, { type Table } from 'dexie';

export interface LocalPhoto {
  key: string;
  blob: Blob;
  bankId: number;
  month: number;
  year: number;
  createdAt: Date;
}

class CashbackDb extends Dexie {
  photos!: Table<LocalPhoto, string>;

  constructor() {
    super('cashback-hunter');
    this.version(1).stores({
      photos: 'key, bankId, month, year, createdAt, [bankId+month+year]',
    });
  }
}

export const localDb = new CashbackDb();

export async function savePhoto(
  bankId: number,
  month: number,
  year: number,
  file: File,
): Promise<string> {
  const key = `photo_${bankId}_${month}_${year}_${Date.now()}`;
  await localDb.photos.put({
    key,
    blob: file,
    bankId,
    month,
    year,
    createdAt: new Date(),
  });
  return key;
}

export async function getPhoto(key: string): Promise<Blob | undefined> {
  const record = await localDb.photos.get(key);
  return record?.blob;
}

export async function getPhotoUrl(key: string): Promise<string | null> {
  const blob = await getPhoto(key);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function deletePhoto(key: string): Promise<void> {
  await localDb.photos.delete(key);
}

export async function getPhotosByBank(
  bankId: number,
  month: number,
  year: number,
): Promise<LocalPhoto[]> {
  return localDb.photos
    .where('[bankId+month+year]')
    .equals([bankId, month, year])
    .toArray();
}
