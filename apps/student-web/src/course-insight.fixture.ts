import type { CourseInsightResponseDtoType } from '@course-data/contracts';

const observedAt = '2026-07-20T10:00:00.000Z';

export const fullCourseInsightFixture = {
  item: {
    courseKey: 'ntnu:TDT4136:2026-autumn',
    institutionCode: 'NTNU',
    code: 'TDT4136',
    title: {
      state: 'known',
      value: 'Introduction to Artificial Intelligence',
      evidenceIds: ['ntnu-course'],
    },
    credits: {
      state: 'known',
      value: 7.5,
      evidenceIds: ['ntnu-course'],
    },
    level: {
      state: 'known',
      value: 'bachelor',
      evidenceIds: ['ntnu-course'],
    },
    teachingLanguage: {
      state: 'known',
      value: 'English',
      evidenceIds: ['ntnu-course'],
    },
    offerings: {
      state: 'known',
      value: [
        {
          academicYear: 2026,
          season: 'autumn',
          campuses: ['Trondheim'],
          deliveryModes: ['in-person'],
        },
      ],
      evidenceIds: ['ntnu-course'],
    },
    content: {
      state: 'known',
      value:
        'Search, knowledge representation, reasoning, planning, machine learning, and intelligent agents.',
      evidenceIds: ['ntnu-content'],
    },
    learningOutcomes: {
      state: 'known',
      value:
        'Students should be able to explain central AI methods, select suitable techniques, and implement solutions to representative problems.',
      evidenceIds: ['ntnu-content'],
    },
    teachingMethods: {
      state: 'known',
      value:
        'Lectures introduce theory and methods. Exercises develop practical problem-solving skills.',
      evidenceIds: ['ntnu-teaching'],
    },
    workForms: {
      state: 'known',
      value: ['lectures', 'exercises', 'self-study'],
      evidenceIds: ['ntnu-teaching'],
    },
    assessment: {
      state: 'known',
      value: [
        {
          form: 'written-exam',
          description: 'Individual written school exam',
          requirement: {
            state: 'unknown',
            reason: 'The fixture does not state the component requirement rule.',
            evidenceIds: [],
          },
          weightPercent: {
            state: 'known',
            value: 100,
            evidenceIds: ['ntnu-assessment'],
          },
          duration: {
            state: 'known',
            value: '4 hours',
            evidenceIds: ['ntnu-assessment'],
          },
          workloadPattern: {
            state: 'unknown',
            reason: 'The fixture does not state the workload timing.',
            evidenceIds: [],
          },
        },
      ],
      evidenceIds: ['ntnu-assessment'],
    },
    obligatoryActivities: {
      state: 'known',
      value: [
        {
          description: 'Approved exercises',
          form: {
            state: 'known',
            value: 'assignment',
            evidenceIds: ['ntnu-assessment'],
          },
          workloadPattern: {
            state: 'unknown',
            reason: 'The fixture does not state the workload timing.',
            evidenceIds: [],
          },
        },
      ],
      evidenceIds: ['ntnu-assessment'],
    },
    collaboration: {
      state: 'unknown',
      reason:
        'The fixture does not provide enough evidence to classify ordinary coursework as individual or group work.',
      evidenceIds: ['ntnu-teaching'],
    },
    attendance: {
      state: 'unknown',
      reason: 'No explicit attendance requirement is present in the fixture.',
      evidenceIds: ['ntnu-teaching'],
    },
    onlineParticipation: {
      state: 'unavailable',
      reason: 'The fixture does not describe a supported online participation option.',
      evidenceIds: ['ntnu-course'],
    },
    prerequisites: {
      state: 'known',
      value: 'Basic programming, algorithms, and discrete mathematics are recommended.',
      evidenceIds: ['ntnu-requirements'],
    },
    accessRestrictions: {
      state: 'unknown',
      reason: 'No explicit access restriction is represented in the fixture.',
      evidenceIds: ['ntnu-requirements'],
    },
    gradeOutcomes: {
      period: {
        state: 'known',
        value: { fromYear: 2021, toYear: 2025 },
        evidenceIds: ['grades-fixture'],
      },
      sampleSize: {
        state: 'known',
        value: 640,
        evidenceIds: ['grades-fixture'],
      },
      distribution: {
        state: 'known',
        value: [
          { grade: 'A', count: 102, percentage: 15.9 },
          { grade: 'B', count: 164, percentage: 25.6 },
          { grade: 'C', count: 182, percentage: 28.4 },
          { grade: 'D', count: 93, percentage: 14.5 },
          { grade: 'E', count: 46, percentage: 7.2 },
          { grade: 'F', count: 53, percentage: 8.3 },
        ],
        evidenceIds: ['grades-fixture'],
      },
      failureRatePercent: {
        state: 'known',
        value: 8.3,
        evidenceIds: ['grades-fixture'],
      },
      averageGrade: {
        state: 'unavailable',
        reason: 'The fixture source does not publish a supported average grade.',
        evidenceIds: ['grades-fixture'],
      },
      medianGrade: {
        state: 'unavailable',
        reason: 'The fixture source does not publish a supported median grade.',
        evidenceIds: ['grades-fixture'],
      },
    },
    sourceStatuses: [
      {
        provider: 'NTNU course catalogue fixture',
        status: 'available',
        observedAt,
        warning: 'Prototype fixture; replace with the live validated NTNU adapter.',
      },
      {
        provider: 'Grade outcomes fixture',
        status: 'available',
        observedAt,
        warning: 'Illustrative statistics; do not treat as current official results.',
      },
    ],
    evidence: [
      {
        id: 'ntnu-course',
        provider: 'NTNU course catalogue fixture',
        kind: 'fixture',
        recordId: 'TDT4136-2026-autumn',
        sourceUrl: 'https://www.ntnu.edu/studies/courses/TDT4136',
        sourcePeriod: '2026 autumn',
        observedAt,
        excerpt: 'Identity, credits, language, level, and offering fixture.',
        inferenceRule: null,
      },
      {
        id: 'ntnu-content',
        provider: 'NTNU course catalogue fixture',
        kind: 'fixture',
        recordId: 'TDT4136-content',
        sourceUrl: 'https://www.ntnu.edu/studies/courses/TDT4136',
        sourcePeriod: '2026 autumn',
        observedAt,
        excerpt: 'Content and learning-outcomes fixture.',
        inferenceRule: null,
      },
      {
        id: 'ntnu-teaching',
        provider: 'NTNU course catalogue fixture',
        kind: 'fixture',
        recordId: 'TDT4136-teaching',
        sourceUrl: 'https://www.ntnu.edu/studies/courses/TDT4136',
        sourcePeriod: '2026 autumn',
        observedAt,
        excerpt: 'Teaching-method and work-form fixture.',
        inferenceRule: null,
      },
      {
        id: 'ntnu-assessment',
        provider: 'NTNU course catalogue fixture',
        kind: 'fixture',
        recordId: 'TDT4136-assessment',
        sourceUrl: 'https://www.ntnu.edu/studies/courses/TDT4136',
        sourcePeriod: '2026 autumn',
        observedAt,
        excerpt: 'Assessment and obligatory-activity fixture.',
        inferenceRule: null,
      },
      {
        id: 'ntnu-requirements',
        provider: 'NTNU course catalogue fixture',
        kind: 'fixture',
        recordId: 'TDT4136-requirements',
        sourceUrl: 'https://www.ntnu.edu/studies/courses/TDT4136',
        sourcePeriod: '2026 autumn',
        observedAt,
        excerpt: 'Prerequisite and access-restriction fixture.',
        inferenceRule: null,
      },
      {
        id: 'grades-fixture',
        provider: 'Grade outcomes fixture',
        kind: 'fixture',
        recordId: 'TDT4136-2021-2025',
        sourceUrl: null,
        sourcePeriod: '2021–2025',
        observedAt,
        excerpt: 'Illustrative aggregate grade distribution.',
        inferenceRule: null,
      },
    ],
  },
  meta: { partial: false },
} satisfies CourseInsightResponseDtoType;

export const partialCourseInsightFixture = {
  ...fullCourseInsightFixture,
  item: {
    ...fullCourseInsightFixture.item,
    gradeOutcomes: {
      period: {
        state: 'unavailable',
        reason: 'The grade source did not respond.',
        evidenceIds: [],
      },
      sampleSize: {
        state: 'unavailable',
        reason: 'The grade source did not respond.',
        evidenceIds: [],
      },
      distribution: {
        state: 'unavailable',
        reason: 'The grade source did not respond.',
        evidenceIds: [],
      },
      failureRatePercent: {
        state: 'unavailable',
        reason: 'The grade source did not respond.',
        evidenceIds: [],
      },
      averageGrade: {
        state: 'unavailable',
        reason: 'The grade source did not respond.',
        evidenceIds: [],
      },
      medianGrade: {
        state: 'unavailable',
        reason: 'The grade source did not respond.',
        evidenceIds: [],
      },
    },
    sourceStatuses: [
      fullCourseInsightFixture.item.sourceStatuses[0]!,
      {
        provider: 'Grade outcomes fixture',
        status: 'failed',
        observedAt,
        warning:
          'Grade outcomes are temporarily unavailable. The independently sourced course details remain usable.',
      },
    ],
    evidence: fullCourseInsightFixture.item.evidence.filter(
      (evidence) => evidence.id !== 'grades-fixture',
    ),
  },
  meta: { partial: true },
} satisfies CourseInsightResponseDtoType;
