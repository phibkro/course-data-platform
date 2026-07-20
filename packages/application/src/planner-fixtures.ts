import {
  decodeProgrammeVersion,
  evaluateScenario,
  generateBaselineScenario,
  type PlanningScenarioId,
} from '@course-data/study-kernel';

export const demoProgrammeVersion = decodeProgrammeVersion({
  id: 'no.ntnu:bit:2026',
  programmeId: 'no.ntnu:bit',
  institutionId: 'no.ntnu',
  institutionShortName: 'NTNU',
  title: 'Informatics — bachelor',
  cohortStartYear: 2026,
  startSeason: 'autumn',
  durationTerms: 6,
  dataRevision: 'fixture-planner-v1',
  relationAuthority: 'fixture',
  requirements: [
    {
      kind: 'required-course',
      id: 'required:programming',
      title: 'Programming foundation',
      course: {
        courseVersionId: 'no.ntnu:TDT4109:2026',
        code: 'TDT4109',
        title: 'Information Technology, Introduction',
        credits: 7.5,
        recommendedTermIndex: 0,
      },
      evidenceRefs: ['fixture:programme-roadmap'],
    },
    {
      kind: 'required-course',
      id: 'required:mathematics',
      title: 'Mathematics foundation',
      course: {
        courseVersionId: 'no.ntnu:TMA4100:2026',
        code: 'TMA4100',
        title: 'Mathematics 1',
        credits: 7.5,
        recommendedTermIndex: 0,
      },
      evidenceRefs: ['fixture:programme-roadmap'],
    },
    {
      kind: 'required-course',
      id: 'required:algorithms',
      title: 'Algorithms foundation',
      course: {
        courseVersionId: 'no.ntnu:TDT4120:2026',
        code: 'TDT4120',
        title: 'Algorithms and Data Structures',
        credits: 7.5,
        recommendedTermIndex: 1,
      },
      evidenceRefs: ['fixture:programme-roadmap'],
    },
    {
      kind: 'required-course',
      id: 'required:ai',
      title: 'Artificial intelligence foundation',
      course: {
        courseVersionId: 'no.ntnu:TDT4136:2026',
        code: 'TDT4136',
        title: 'Introduction to Artificial Intelligence',
        credits: 7.5,
        recommendedTermIndex: 2,
      },
      evidenceRefs: ['fixture:programme-roadmap'],
    },
    {
      kind: 'required-course',
      id: 'required:software-engineering',
      title: 'Software engineering foundation',
      course: {
        courseVersionId: 'no.ntnu:TDT4140:2026',
        code: 'TDT4140',
        title: 'Software Engineering',
        credits: 7.5,
        recommendedTermIndex: 3,
      },
      evidenceRefs: ['fixture:programme-roadmap'],
    },
    {
      kind: 'required-course',
      id: 'required:project',
      title: 'Capstone project',
      course: {
        courseVersionId: 'no.ntnu:TDT4290:2026',
        code: 'TDT4290',
        title: 'Customer-Driven Project',
        credits: 15,
        recommendedTermIndex: 5,
      },
      evidenceRefs: ['fixture:programme-roadmap'],
    },
    {
      kind: 'choose-n',
      id: 'choice:advanced-programming',
      title: 'Choose one advanced programming course',
      choose: 1,
      options: [
        {
          courseVersionId: 'no.ntnu:TDT4165:2026',
          code: 'TDT4165',
          title: 'Programming Languages',
          credits: 7.5,
          recommendedTermIndex: 4,
        },
        {
          courseVersionId: 'no.ntnu:TDT4258:2026',
          code: 'TDT4258',
          title: 'Low-Level Programming',
          credits: 7.5,
          recommendedTermIndex: 4,
        },
      ],
      defaultCourseVersionIds: ['no.ntnu:TDT4165:2026'],
      evidenceRefs: ['fixture:programme-roadmap'],
    },
    {
      kind: 'minimum-credits',
      id: 'credits:illustrative-roadmap',
      title: 'Illustrative roadmap credits',
      minimumCredits: 60,
      eligibleCourseVersionIds: [],
      evidenceRefs: ['fixture:programme-roadmap'],
    },
  ],
});

export const demoPlanningScenario = generateBaselineScenario(demoProgrammeVersion, {
  id: 'scenario:ntnu-informatics-baseline' as PlanningScenarioId,
  title: 'NTNU Informatics baseline',
});

export const getDemoPlannerProjection = () => ({
  programme: demoProgrammeVersion,
  scenario: demoPlanningScenario,
  evaluation: evaluateScenario(demoProgrammeVersion, demoPlanningScenario, {
    maximumCreditsPerTerm: 30,
  }),
  meta: {
    note: 'Illustrative fixture only; it is not an official NTNU curriculum.',
    dataRevision: demoProgrammeVersion.dataRevision,
  },
});
