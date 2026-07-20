'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DoctorVoiceRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/doctor/chat');
  }, [router]);

  return null;
}
