'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PatientVoiceRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/patient/chat');
  }, [router]);

  return null;
}
