import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { signOut } from './actions';

export default async function DashboardPage() {
  const supabase = createSupabaseServerComponentClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/auth/signin');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl mr-2">🍎</span>
              <span className="text-xl font-semibold">Dating App</span>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="text-gray-700 hover:text-gray-900 px-4 py-2"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-4">Welcome to your Dashboard!</h1>
          <p className="text-gray-600 mb-4">
            You're successfully authenticated. 🎉
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Current Phase:</strong> Phase 1-2 (Infrastructure + Authentication)
            </p>
            <p className="text-sm text-blue-700 mt-2">
              Next: Phase 3 - Basic Profile functionality
            </p>
          </div>
          <div className="mt-6">
            <p className="text-sm text-gray-500">
              Email: {session.user.email}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              User ID: {session.user.id}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

