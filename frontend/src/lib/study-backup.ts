import { supabase } from '@/integrations/supabase/client';

interface BackupItem {
  card_id: string;
  rating: string;
  reviewed_at: string;
  product_id: string;
  next_review: string;
  correct_count: number;
  incorrect_count: number;
}

function getBackupKey(email: string, productId: string): string {
  return `session_backup_${email}_${productId}`;
}

export function saveToBackup(email: string, productId: string, item: BackupItem) {
  try {
    const key = getBackupKey(email, productId);
    const backup: BackupItem[] = JSON.parse(localStorage.getItem(key) || '[]');
    const filtered = backup.filter(b => b.card_id !== item.card_id);
    filtered.push(item);
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Backup save failed (non-blocking):', err);
  }
}

export function removeFromBackup(email: string, productId: string, cardId: string) {
  try {
    const key = getBackupKey(email, productId);
    const backup: BackupItem[] = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = backup.filter(b => b.card_id !== cardId);
    if (updated.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(updated));
    }
  } catch (err) {
    console.warn('Backup remove failed (non-blocking):', err);
  }
}

export async function syncBackup(email: string, productId: string): Promise<number> {
  // Clean up any stale backup keys from old sessions
  cleanStaleBackups(email, productId);

  try {
    const key = getBackupKey(email, productId);
    const backup: BackupItem[] = JSON.parse(localStorage.getItem(key) || '[]');
    if (backup.length === 0) return 0;

    let synced = 0;
    for (const item of backup) {
      try {
        await supabase.from('student_progress').upsert({
          student_email: email,
          card_id: item.card_id,
          product_id: item.product_id,
          rating: item.rating,
          next_review: item.next_review,
          reviewed_at: item.reviewed_at,
          correct_count: item.correct_count,
          incorrect_count: item.incorrect_count,
        }, { onConflict: 'student_email,card_id' });
        synced++;
      } catch {
        break;
      }
    }

    if (synced === backup.length) {
      localStorage.removeItem(key);
    } else {
      const remaining = backup.slice(synced);
      localStorage.setItem(key, JSON.stringify(remaining));
    }

    return synced;
  } catch (err) {
    console.warn('Sync backup failed (non-blocking):', err);
    return 0;
  }
}

/**
 * Remove stale/orphaned backup keys from localStorage.
 * Keeps only the backup for the current email+product combination.
 */
function cleanStaleBackups(currentEmail: string, currentProductId: string) {
  try {
    const currentKey = getBackupKey(currentEmail, currentProductId);
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('session_backup_') && key !== currentKey) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch {
    // non-blocking
  }
}
