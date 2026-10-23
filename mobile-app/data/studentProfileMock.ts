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
    title: 'Account Details',
    subtitle: 'View and update your personal information',
  },
  {
    id: 'appearance',
    icon: 'droplet' as const,
    title: 'Appearance',
    subtitle: 'Customize how LearnIQ looks for you',
  },
  {
    id: 'notifications',
    icon: 'bell' as const,
    title: 'Notifications',
    subtitle: 'Manage your notification preferences',
  },
  {
    id: 'privacy',
    icon: 'lock' as const,
    title: 'Privacy & Security',
    subtitle: 'Manage your password and security settings',
  },
  {
    id: 'about',
    icon: 'info' as const,
    title: 'About LearnIQ',
    subtitle: 'App information, support and privacy policy',
  },
];
// .
