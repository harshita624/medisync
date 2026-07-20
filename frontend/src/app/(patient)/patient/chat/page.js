import { Suspense } from 'react';
import ChatAssistant from '@/components/chat/ChatAssistant';

export default function PatientChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatAssistant role="patient" />
    </Suspense>
  );
}