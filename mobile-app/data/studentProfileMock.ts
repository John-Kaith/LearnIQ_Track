export const studentProfileMock = {
  fullName: 'John Kaith Yamomo',
  initials: 'JK',
  roleAcademic: 'Student • Grade 12 STEM',
  idNumber: '0123-2391',
  approvalStatus: 'approved' as const,
  section: 'STEM 12-1',
  strand: 'STEM',
  adviser: 'Mr. Santos',
  memberSince: 'Aug 2023',
};

export const profileSettingsItems = [
  {
    id: 'account',
    icon: 'user' as const,
    iconColor: '#60a5fa',
    title: 'Account Details',
    subtitle: 'View and update your personal information',
  },
  {
    id: 'appearance',
    icon: 'droplet' as const,
    iconColor: '#a78bfa',
    title: 'Appearance',
    subtitle: 'Customize how LearnIQ looks for you',
  },
  {
    id: 'notifications',
    icon: 'bell' as const,
    iconColor: '#fb923c',
    title: 'Notifications',
    subtitle: 'Manage your notification preferences',
  },
  {
    id: 'privacy',
    icon: 'lock' as const,
    iconColor: '#34d399',
    title: 'Privacy & Security',
    subtitle: 'Manage your password and security settings',
  },
  {
    id: 'about',
    icon: 'info' as const,
    iconColor: '#60a5fa',
    title: 'About LearnIQ',
    subtitle: 'App information, support and privacy policy',
  },
];
