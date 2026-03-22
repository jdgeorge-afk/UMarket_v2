import Modal from './Modal'

export default function ContactModal({ listing, seller, onClose }) {
  if (!seller && !listing) return null

  const getContact = () => {
    const type  = listing?.contact_type  || seller?.contact_type
    const value = listing?.contact_value || seller?.contact
    if (!type || !value) return null
    switch (type) {
      case 'phone':
        return {
          label: 'Phone / Text',
          display: value,
          href: `tel:${value}`,
          icon: '📱',
        }
      case 'email':
        return {
          label: 'Email',
          display: value,
          href: `mailto:${value}`,
          icon: '✉️',
        }
      case 'instagram':
        return {
          label: 'Instagram',
          display: `@${value}`,
          href: `https://instagram.com/${value}`,
          icon: '📸',
        }
      case 'snapchat':
        return {
          label: 'Snapchat',
          display: '@' + value,
          href: 'https://snapchat.com/add/' + value,
          icon: '👻',
        }
      default:
        return null
    }
  }

  const contact = getContact()

  return (
    <Modal onClose={onClose}>
      <h2 className="text-xl font-bold text-gray-900 mb-1">
        Contact {seller?.name ?? 'Seller'}
      </h2>
      <p className="text-sm text-gray-400 mb-6">Seller's preferred contact method</p>

      {contact ? (
        <a
          href={contact.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-4 bg-school-primary/5 border border-school-primary/20 rounded-xl hover:bg-school-primary/10 transition-colors group"
        >
          <span className="text-3xl">{contact.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 mb-0.5">{contact.label}</p>
            <p className="font-semibold text-gray-900 truncate">{contact.display}</p>
          </div>
          <svg className="w-5 h-5 text-school-primary group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </a>
      ) : (
        <div className="text-center py-6 text-gray-400">
          <p className="text-3xl mb-2">🤷</p>
          <p className="text-sm">This seller hasn't added contact info yet.</p>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-5 leading-relaxed">
        🛡️ Always meet in a public place on campus.<br />Never send payment before seeing the item.
      </p>
    </Modal>
  )
}
