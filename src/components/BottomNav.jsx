// Mobile-only bottom navigation bar (hidden on lg+)

function HomeIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}
function HeartIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" strokeWidth={1.8} />
      <path strokeLinecap="round" d="M12 8v8M8 12h8" />
    </svg>
  )
}
function UserIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

export default function BottomNav({ currentView, onFeed, onPost, onProfile }) {
  const tabs = [
    { label: 'Home',    view: 'feed',    Icon: HomeIcon, action: onFeed },
    { label: 'Post',    view: null,      Icon: PlusIcon, action: onPost,    isPost: true },
    { label: 'Profile', view: 'profile', Icon: UserIcon, action: onProfile },
  ]

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-bottom">
      <div className="flex h-16">
        {tabs.map((tab) => {
          const active = !tab.isPost && currentView === tab.view
          return (
            <button
              key={tab.label}
              onClick={tab.action}
              className={[
                'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
                tab.isPost
                  ? 'text-school-primary'
                  : active
                  ? 'text-school-primary'
                  : 'text-gray-400 hover:text-gray-600',
              ].join(' ')}
            >
              <tab.Icon />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
