import { Suspense } from 'react';
import ChatAssistant from '@/components/chat/ChatAssistant';

export default function DoctorChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatAssistant role="doctor" />
    </Suspense>
  );
}