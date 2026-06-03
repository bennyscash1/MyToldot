/**
 * Themed loading messages for the generic LoadingOverlay, keyed by variant and
 * locale. Pure data + the variant union — no React here so it can be imported
 * anywhere (including server) without pulling in client code.
 *
 * Keep the arrays in sync between `he` and `en`; the overlay rotates through
 * whichever array matches the active locale.
 */
export type LoadingVariant =
  | 'creating-tree'
  | 'creating-tree-grounded'
  | 'refining-tree'
  | 'ai-biography'
  | 'saving';

export const LOADING_MESSAGES: Record<
  LoadingVariant,
  { he: string[]; en: string[] }
> = {
  'creating-tree': {
    he: [
      'דור הולך ודור בא — והנה הם, כולם יחד...',
      'משפחה היא לא רק שמות. זו שרשרת של זיכרון.',
      'מסדר את הענפים, מחבר בין הדורות...',
      'כל אחד מהם הותיר חותם. אנחנו מסדרים אותו...',
      'רגע, הקסם קורה — תכף תראו...',
    ],
    en: [
      'Generations come and generations go — and here they all are...',
      "Family isn't just names. It's a chain of memory.",
      'Arranging the branches, connecting the generations...',
      "Each of them left a mark. We're putting it in order...",
      'Almost there — the magic is happening...',
    ],
  },
  'creating-tree-grounded': {
    he: [
      'מחפש במאגרי מידע ציבוריים…',
      'מצליב מקורות, בונה את העץ…',
      'זה עשוי לקחת יותר זמן מהרגיל — תודה על הסבלנות',
      'מחבר בין הדורות לפי מה שנמצא…',
    ],
    en: [
      'Searching public knowledge bases…',
      'Cross-referencing sources, building your tree…',
      'This may take longer than usual — thanks for waiting',
      'Connecting generations from what we found…',
    ],
  },
  'refining-tree': {
    he: [
      'מעדכן את העץ...',
      'מתאים את הענפים לתיקון שלך...',
      'כמעט סיימנו...',
    ],
    en: [
      'Updating the tree...',
      'Adjusting branches to your correction...',
      'Nearly done...',
    ],
  },
  'ai-biography': {
    he: [
      'חוקר בכל הקצוות...',
      'מצליב מקורות, אוסף סיפורים...',
      'מחפש את החוט המקשר...',
      'הרבה היסטוריה — רגע לסכם אותה...',
    ],
    en: [
      'Searching every corner...',
      'Cross-referencing sources, gathering stories...',
      'Finding the connecting thread...',
      'Lots of history — just a moment to sum it up...',
    ],
  },
  saving: {
    he: ['שומר...'],
    en: ['Saving...'],
  },
};
