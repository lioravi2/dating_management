'use client';

import { NavigationLink, useNavigation } from '@/lib/navigation';

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbsProps {
  customItems?: BreadcrumbItem[];
}

export default function Breadcrumbs({ customItems }: BreadcrumbsProps = {}) {
  const navigation = useNavigation();
  const pathname = navigation.getCurrentPath();
  
  // Don't show breadcrumbs on home page or auth pages
  if (pathname === '/' || pathname.startsWith('/auth')) {
    return null;
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', href: '/dashboard' },
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

  // Add partners breadcrumb
  if (pathname.startsWith('/partners')) {
    breadcrumbs.push({ label: 'Partners', href: '/partners' });
    
    // Add partner detail breadcrumb if customItems provided
    if (customItems && customItems.length > 0) {
      breadcrumbs.push(...customItems);
    }
  }

  // Use custom items if provided (for dynamic routes)
  if (customItems && customItems.length > 0 && !pathname.startsWith('/partners')) {
    breadcrumbs.push(...customItems);
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
                <NavigationLink
                  href={crumb.href}
                  className="text-gray-600 hover:text-gray-900 transition-colors flex items-center"
                >
                  {index === 0 && (
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      />
                    </svg>
                  )}
                  {crumb.label}
                </NavigationLink>
              )}
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}

