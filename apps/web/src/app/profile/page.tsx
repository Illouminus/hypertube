'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { ProfileForm } from '@/components/profile';

export default function ProfilePage() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login?redirect=/profile');
    }
  }, [router]);

  // Don't render if not authenticated
  if (typeof window !== 'undefined' && !isAuthenticated()) {
    return null;
  }

  return <ProfileForm />;
}
