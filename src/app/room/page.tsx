import { Suspense } from 'react';
import RoomPage from './RoomPage';

export default function Room() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-6xl animate-spin">🔍</div>
      </div>
    }>
      <RoomPage />
    </Suspense>
  );
}
