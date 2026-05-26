export const colors = {
  bg: '#FAF6EE',
  surface: '#FFFCF5',
  surface2: '#F4EFE2',
  ink: '#2A2620',
  inkMuted: '#807366',
  border: '#E8DFCB',
  accent: '#C4543B',        // terracotta — primary action
  accent2: '#7B9A66',       // sage — secondary action / success
  accentSoft: '#F4D9CF',
  accentText: '#FFFCF5',
  danger: '#B23A2A',
} as const;

export const radii = { sm: 10, md: 16, lg: 22 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const fonts = {
  heading: 'SourceSerif4_600SemiBold',
  headingItalic: 'SourceSerif4_400Regular_Italic',
  body: 'SourceSans3_400Regular',
  bodyBold: 'SourceSans3_600SemiBold',
} as const;

export const shadows = {
  soft: {
    shadowColor: '#C4543B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
};
