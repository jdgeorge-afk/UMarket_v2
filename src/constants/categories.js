export const CATEGORIES = [
  { id: 'all',         label: 'All',          icon: '' },
  { id: 'housing',     label: 'Housing',      icon: '' },
  { id: 'sublease',    label: 'Sublease',     icon: '' },
  { id: 'looking_for',    label: 'Looking For',         icon: '' },
  { id: 'looking_housing', label: 'Looking for Housing', icon: '' },
  { id: 'textbooks',   label: 'Textbooks',    icon: '' },
  { id: 'furniture',   label: 'Furniture',    icon: '' },
  { id: 'electronics', label: 'Electronics',  icon: '' },
  { id: 'clothing',    label: 'Clothing',     icon: '' },
  { id: 'sports',      label: 'Sports',       icon: '' },
  { id: 'misc',        label: 'Misc',         icon: '' },
]

export const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Poor']

export const GRADES = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad', 'Alumni']

export const REPORT_REASONS = [
  'Scam or fraud',
  'Inappropriate content',
  'Wrong category',
  'Already sold',
  'Spam',
  'Other',
]

export const getCategoryLabel = (id) =>
  CATEGORIES.find((c) => c.id === id)?.label ?? id

export const getCategoryIcon = (id) =>
  CATEGORIES.find((c) => c.id === id)?.icon ?? ''
