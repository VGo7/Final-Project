"use client";
import { useEffect } from 'react';
import { initFirebase } from '@/utils/auth';

export default function FirebasePreload() {
  useEffect(() => {
    // Only warm up Firebase on the client if config exists. Fire-and-forget.
    if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      initFirebase().catch((e) => {
        // swallow errors here — we'll fall back to local auth if needed
        console.debug('Firebase preload failed:', e);
      });
    }
  }, []);

  return null;
}
