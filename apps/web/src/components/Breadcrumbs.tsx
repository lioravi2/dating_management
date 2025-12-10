'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BreadcrumbItem {
  label: string;
  href: string;
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  
  // Don't show breadcrumbs on home page or auth pages
  if (pathname === '/' || pathname.startsWith('/auth')) {
    return null;
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Dashboard', href: '/dashboard' },
  ];

  // Add profile breadcrumb
  if (pathname === '/profile') {
    breadcrumbs.push({ label: 'Profile', href: '/profile' });
  }

  // Add upgrade breadcrumb
  if (pathname === '/upgrade') {
    breadcrumbs.push({ label: 'Upgrade', href: '/upgrade' });
  }

  // Add billing breadcrumb
  if (pathname === '/billing') {
    breadcrumbs.push({ label: 'Billing', href: '/billing' });
  }

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-2 py-3">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.href} className="flex items-center space-x-2">
              {index > 0 && <span className="text-gray-400">/</span>}
              {index === breadcrumbs.length - 1 ? (
                <span className="text-gray-900 font-medium">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}

