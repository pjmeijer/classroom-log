export const copy = {
  // Home
  appTitle: 'Observationer',
  roster: 'Klasseliste',
  todaysNotes: 'Dagens noter',
  voiceOff: 'Stemme fra',
  emptyRoster: 'Ingen elever endnu. Tilføj din første under Indstillinger.',
  emptyNotes: 'Ingen noter i dag endnu.',
  generateSummary: '＋ Lav opsummering',
  gestureHint: 'Tip — hold på en elev for at skrive en note i stedet.',

  // Recording (tile + bar)
  recording: 'Optager',
  stopAndSave: 'Stop & gem',
  cancel: 'Annuller',

  // Toast
  savedFor: (name: string) => `Gemt for ${name}`,
  undo: 'Fortryd',
  edit: 'Redigér',

  // Roster tile meta (note count for today)
  notesToday: (count: number): string => {
    if (count === 0) return 'Ingen noter endnu';
    if (count === 1) return '1 note i dag';
    return `${count} noter i dag`;
  },

  // Note modal
  save: 'Gem',
  update: 'Opdatér',
  holdToDelete: 'Hold for at slette',
  deleteConfirmTitle: 'Slet denne note?',
  deleteConfirmBody: 'Dette kan ikke fortrydes.',
  delete: 'Slet',
  noteTextarea: 'Skriv en note, eller tryk på mikrofonen for at diktere…',
  noteHeaderNote: 'Note',

  // DiscardSheet
  unsavedChanges: 'Du har ikke gemt dine ændringer',
  unsavedBody: 'Vil du gemme noten, kassere den eller fortsætte redigeringen?',
  keepEditing: 'Fortsæt redigering',
  discard: 'Kassér',

  // Settings
  settings: 'Indstillinger',
  serverUrl: 'Server',
  testConnection: 'Test forbindelse',
  addStudent: 'Tilføj elev',
  studentName: 'Elevens navn',

  // Onboarding
  onboardingTitle: 'Velkommen',
  allowMicrophone: 'Tillad mikrofon',
  startUsingApp: 'Begynd at bruge appen',
  onboardingGestureLine:
    'Når du er færdig: tryk på en elev for at optage, eller hold på en elev for at skrive en note i stedet.',
  privacyDisclosureBody:
    'Skrevne noter, transskriberet tekst, indstillinger og din klasseliste ligger udelukkende i en lokal database på denne enhed.',
  privacyDisclosureBody2:
    'Når du optager en stemmenote, sendes lydbytes til serveren netop længe nok til at blive transskriberet; intet skrives til disk. Når du laver en opsummering, sendes notens tekst til serveren for Claude. Intet gemmes efter at hvert svar er returneret.',

  // Errors
  micDeniedSnack: 'Mikrofon deaktiveret — hold på en elev for at skrive i stedet.',
  draftSavedToast: 'Gemt som kladde.',
  transcribeError: '(fejl under transskribering — tryk på noten for at prøve igen)',
  retryTranscription: 'Prøv igen',
  emptyRecording: '(tom optagelse)',
  summaryUpstreamError: 'Opsummeringstjenesten er midlertidigt utilgængelig. Prøv igen om et øjeblik.',
  summaryRetry: 'Prøv igen',

  // Summary screen
  draftSummary: 'Kladde — opsummering',
  draftReviewBeforeSharing: 'Kladde — gennemse før deling',
  student: 'Elev',
  date: 'Dato',
  generate: 'Generér',
  positives: 'Positive iagttagelser',
  concerns: 'Bekymringer',
  patterns: 'Mønstre',
  nextSteps: 'Forslag til næste skridt',
  rawNotes: 'Rå noter',
  copyAll: 'Kopier alt',
  noNotesAlertTitle: 'Ingen noter',
  noNotesAlertBody: (name: string) => `Ingen noter for ${name} på den valgte dag.`,
  copiedAlertTitle: 'Kopieret',
  copiedAlertBody: 'Opsummering kopieret til udklipsholder.',
  backToHome: '← Tilbage',
} as const;
