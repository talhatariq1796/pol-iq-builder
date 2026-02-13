import { v4 as uuid } from 'uuid';

let currentId: string | null = null;
export function getRequestId(): string {
  if (!currentId) currentId = uuid();
  return currentId;
} 