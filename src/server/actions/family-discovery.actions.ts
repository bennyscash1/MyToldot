'use server';

import { revalidatePath } from 'next/cache';
import { TreeMemberRole } from '@prisma/client';

import { withAction, type ActionResult } from '@/lib/api/action-result';
import { requireTreeRole } from '@/lib/api/auth';
import { Errors } from '@/lib/api/errors';
import { CuidSchema } from '@/features/family-tree/schemas/person.schema';
import { prisma } from '@/lib/prisma';
import { discoverFamilyMembersWithGemini } from '@/server/lib/family-discovery/gemini';
import { enrichAndFilterProposals, proposalToPersonInput } from '@/server/lib/family-discovery/proposal-utils';
import {
  CommitDiscoveredMemberSchema,
  type FamilyMemberProposal,
  type FamilyMemberProposalDto,
} from '@/server/lib/family-discovery/schema';
import {
  buildTreeSummaryBlock,
  collectExistingHebrewNames,
  type TreePersonSummary,
  type TreeRelationshipSummary,
} from '@/server/lib/family-discovery/summarize-tree';
import {
  addChildInTree,
  addParentInTree,
  addSiblingInTree,
  addSpouseInTree,
  type AddedRelativeDto,
} from '@/server/services/tree.service';

function revalidateTree(): void {
  revalidatePath('/[locale]/tree', 'page');
}

async function loadTreeForDiscovery(treeId: string): Promise<{
  treeName: string;
  aboutText: string | null;
  persons: TreePersonSummary[];
  relationships: TreeRelationshipSummary[];
}> {
  const tree = await prisma.tree.findUnique({
    where: { id: treeId },
    select: {
      name: true,
      about_text: true,
      persons: {
        select: {
          id: true,
          first_name_he: true,
          last_name_he: true,
          maiden_name: true,
          first_name: true,
          last_name: true,
          gender: true,
          birth_date: true,
          death_date: true,
          birth_place: true,
        },
      },
      relationships: {
        select: {
          id: true,
          relationship_type: true,
          person1_id: true,
          person2_id: true,
        },
      },
    },
  });

  if (!tree) throw Errors.notFound('Tree');

  return {
    treeName: tree.name,
    aboutText: tree.about_text,
    persons: tree.persons,
    relationships: tree.relationships,
  };
}

export async function discoverFamilyMembersAction(
  treeId: string,
): Promise<ActionResult<{ proposals: FamilyMemberProposalDto[] }>> {
  return withAction(async () => {
    const validatedTreeId = CuidSchema.parse(treeId);
    await requireTreeRole(validatedTreeId, TreeMemberRole.EDITOR);

    if (!process.env.GEMINI_API_KEY) {
      throw Errors.internal('GEMINI_API_KEY is not configured');
    }

    const treeData = await loadTreeForDiscovery(validatedTreeId);
    if (treeData.persons.length === 0) {
      return { proposals: [] };
    }

    const summaryBlock = buildTreeSummaryBlock(treeData);
    const { proposals } = await discoverFamilyMembersWithGemini({
      treeSummaryBlock: summaryBlock,
    });

    const existingNames = collectExistingHebrewNames(treeData.persons);
    const enriched = enrichAndFilterProposals(proposals, treeData.persons, existingNames);

    return { proposals: enriched };
  });
}

export async function commitDiscoveredMemberAction(
  treeId: string,
  proposal: FamilyMemberProposal,
): Promise<ActionResult<AddedRelativeDto>> {
  return withAction(async () => {
    const { treeId: validatedTreeId, proposal: validatedProposal } =
      CommitDiscoveredMemberSchema.parse({ treeId, proposal });

    await requireTreeRole(validatedTreeId, TreeMemberRole.EDITOR);

    const personInput = proposalToPersonInput(validatedProposal);
    const { relatedToPersonId, type } = validatedProposal.relationship;

    let result: AddedRelativeDto;
    switch (type) {
      case 'PARENT':
        result = await addParentInTree({
          treeId: validatedTreeId,
          childId: relatedToPersonId,
          parent: personInput,
        });
        break;
      case 'CHILD':
        result = await addChildInTree({
          treeId: validatedTreeId,
          parent1Id: relatedToPersonId,
          child: personInput,
        });
        break;
      case 'SPOUSE':
        result = await addSpouseInTree({
          treeId: validatedTreeId,
          personId: relatedToPersonId,
          spouse: personInput,
        });
        break;
      case 'SIBLING':
        result = await addSiblingInTree({
          treeId: validatedTreeId,
          existingSiblingId: relatedToPersonId,
          sibling: personInput,
        });
        break;
      default: {
        const _exhaustive: never = type;
        throw Errors.badRequest(`Unknown relationship type: ${_exhaustive}`);
      }
    }

    revalidateTree();
    return result;
  });
}
