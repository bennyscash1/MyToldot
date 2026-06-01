export const UsageLimit = {
  AI_BIOS_PER_USER_PER_DAY: 10,
  IMAGES_PER_TREE: 30,
} as const;

export const UsageScope = {
  AI_BIOS: 'ai_bios',
  IMAGES: 'images',
} as const;

export type UsageScopeValue = (typeof UsageScope)[keyof typeof UsageScope];
