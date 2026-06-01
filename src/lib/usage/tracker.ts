import { prisma } from '@/lib/prisma';

import { getIsraelDay } from './date';
import { aiQuotaExceeded, imageQuotaExceeded } from './errors';
import { UsageLimit } from './limits';

export async function getAiUsageToday(userId: string): Promise<number> {
  const day = getIsraelDay();
  const row = await prisma.aiUsageDaily.findUnique({
    where: { user_id_day: { user_id: userId, day } },
    select: { count: true },
  });
  return row?.count ?? 0;
}

export async function assertAiUsageAllowed(userId: string): Promise<void> {
  const current = await getAiUsageToday(userId);
  if (current >= UsageLimit.AI_BIOS_PER_USER_PER_DAY) {
    throw aiQuotaExceeded(current);
  }
}

export async function incrementAiUsage(userId: string): Promise<void> {
  const day = getIsraelDay();
  await prisma.aiUsageDaily.upsert({
    where: { user_id_day: { user_id: userId, day } },
    create: { user_id: userId, day, count: 1 },
    update: { count: { increment: 1 } },
  });
}

export async function getImageUsage(treeId: string): Promise<number> {
  const row = await prisma.treeImageUsage.findUnique({
    where: { tree_id: treeId },
    select: { uploaded_count: true },
  });
  return row?.uploaded_count ?? 0;
}

export async function assertImageUploadAllowed(treeId: string): Promise<void> {
  const current = await getImageUsage(treeId);
  if (current >= UsageLimit.IMAGES_PER_TREE) {
    throw imageQuotaExceeded(current);
  }
}

export async function incrementImageCount(treeId: string): Promise<void> {
  await prisma.treeImageUsage.upsert({
    where: { tree_id: treeId },
    create: { tree_id: treeId, uploaded_count: 1 },
    update: { uploaded_count: { increment: 1 } },
  });
}

export async function decrementImageCount(treeId: string): Promise<void> {
  await prisma.treeImageUsage.updateMany({
    where: { tree_id: treeId, uploaded_count: { gt: 0 } },
    data: { uploaded_count: { decrement: 1 } },
  });
}
