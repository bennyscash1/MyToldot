import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { topologicalSortNewPeople } from './topo-sort';
import { reconcileMergeProposal } from './reconcile';
import type { ExistingFamilyMember } from './schema';

const existing: ExistingFamilyMember[] = [
  {
    id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx1',
    name: 'משה כהן',
    role: 'founder',
    parentId: null,
    spouseId: null,
    birthDate: null,
  },
];

describe('reconcileMergeProposal', () => {
  it('drops duplicate names against existing family', () => {
    const raw = {
      matchedTo: null,
      newPeople: [
        {
          tempId: 'new_1',
          name: 'משה כהן',
          relation: 'child',
          parentId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx1',
        },
        {
          tempId: 'new_2',
          name: 'נתן כהן',
          relation: 'child',
          parentId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx1',
        },
      ],
      confidence: 'high',
      needsReview: false,
      ambiguousMatches: [],
      notes: '',
    };
    const { proposal } = reconcileMergeProposal(raw, existing);
    assert.equal(proposal.newPeople.length, 1);
    assert.equal(proposal.newPeople[0]?.name, 'נתן כהן');
  });
});

describe('topologicalSortNewPeople', () => {
  it('orders parent temp before child temp', () => {
    const ordered = topologicalSortNewPeople([
      {
        tempId: 'new_2',
        name: 'רוני',
        relation: 'child',
        parentId: 'new_1',
        gender: 'UNKNOWN',
      },
      {
        tempId: 'new_1',
        name: 'נתן',
        relation: 'child',
        parentId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx1',
        gender: 'UNKNOWN',
      },
    ]);
    assert.equal(ordered[0]?.tempId, 'new_1');
    assert.equal(ordered[1]?.tempId, 'new_2');
  });
});
