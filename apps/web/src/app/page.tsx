import Link from 'next/link';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import AttributionTracker from '@/components/attribution/AttributionTracker';

export const metadata: Metadata = {
  title: 'Dating Assistant',
};

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = createSupabaseServerComponentClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    redirect('/dashboard');
  }

  return (
    <>
      <AttributionTracker />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-red-50">
        <div className="max-w-md w-full mx-4 text-center">
          <div className="text-6xl mb-6">🎭</div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Dating Assistant
          </h1>
          <p className="text-gray-600 mb-8">
            What your dating apps are missing...
          </p>
          <div className="space-y-4">
            <Link
              href="/auth/signin"
              data-amplitude-target="homepage-signin-button"
              className="block w-full bg-primary-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              data-amplitude-target="homepage-signup-button"
              className="block w-full border-2 border-primary-600 text-primary-600 py-3 px-6 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
