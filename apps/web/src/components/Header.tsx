import Link from 'next/link';

interface HeaderProps {
  accountType?: string | null;
}

export default function Header({ accountType }: HeaderProps) {
  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="text-2xl mr-2">
              🎭
            </Link>
            <Link href="/dashboard" className="text-xl font-semibold">
              Dating Assistant
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            {accountType === 'pro' && (
              <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                PRO
              </span>
            )}
            {(!accountType || accountType === 'free') && (
              <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold">
                FREE
              </span>
            )}
            <Link
              href="/profile"
              className="text-gray-700 hover:text-gray-900"
            >
              Profile
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-gray-700 hover:text-gray-900"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </div>
    </nav>
  );
}

