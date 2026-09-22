/**
 * Assessment golden course corpus.
 *
 * Contract anchor: docs/product/course-decision-contract.md § Golden course set
 * (10–20 courses covering written/oral/portfolio assessment, project-heavy and
 * group/individual project work, obligatory exercises, attendance, online
 * teaching, failure-rate spread, unavailable statistics, ambiguous evidence).
 *
 * Every known Fact below is quoted from the live NTNU course page for the
 * named code (retrieved 2026-08-24); the evidence excerpt carries the exact
 * page sentence. Anything the page does not establish is an explicit
 * unknown/unavailable Fact — those are valid corpus entries per the contract,
 * not failures. Grade statistics come from the public DBH table 308 endpoint
 * used by the local grades source (retrieved 2026-08-24) or are explicitly
 * unavailable where no fetch was made. No extractor or domain source was
 * changed to admit these entries.
 */
import {
  decodeCourseDecisionSignals,
  decodeCourseGradeSummary,
  decodeCourseInsight,
  decodeCourseSearchItem,
  known,
  unavailable,
  unknown,
  type CourseGradeSummary,
  type CourseInsight,
  type CourseSearchItem,
  type Fact,
} from './model/course-insight';

const observedAt = '2026-08-24T10:00:00.000Z';

interface CorpusCourse {
  readonly code: string;
  readonly term: string;
  readonly title: string;
  readonly credits: number;
  readonly language: string;
  readonly campuses: ReadonlyArray<string>;
  readonly season: 'spring' | 'autumn';
  readonly academicYear: number;
  /** Exact sentences quoted from the live course page. */
  readonly quotes: {
    readonly content: string;
    readonly methods: string;
  };
  /** Work-form keywords present in the methods text (adapter WORK_FORM idiom). */
  readonly workForms: ReadonlyArray<
    'lectures' | 'exercises' | 'laboratory' | 'seminar' | 'project' | 'self-study' | 'other'
  >;
  readonly assessment: ReadonlyArray<{
    readonly form:
      | 'written-exam'
      | 'oral-exam'
      | 'home-exam'
      | 'project'
      | 'portfolio'
      | 'practical'
      | 'assignment'
      | 'other';
    readonly description: string;
    readonly weightPercent: number;
    readonly duration: string | null;
  }>;
  readonly obligatoryActivities: ReadonlyArray<{
    readonly description: string;
    readonly form:
      | 'written-exam'
      | 'oral-exam'
      | 'home-exam'
      | 'project'
      | 'portfolio'
      | 'practical'
      | 'assignment'
      | 'other'
      | null;
  }>;
  readonly collaboration: 'group' | 'mixed' | null;
  readonly attendance: 'required' | null;
  readonly onlineParticipation: 'available' | null;
  readonly gradeOutcomes:
    | {
        readonly kind: 'dbh';
        readonly fromYear: number;
        readonly toYear: number;
        readonly sampleSize: number;
        readonly failureRatePercent: number;
      }
    | { readonly kind: 'unavailable'; readonly reason: string };
}

const CORPUS_RETRIEVED_AT = '2026-08-24';

const corpusCourses: ReadonlyArray<CorpusCourse> = [
  {
    code: 'TDT4109',
    term: '2026-autumn',
    title: 'Information Technology, Introduction',
    credits: 7.5,
    language: 'Norwegian',
    campuses: ['Trondheim'],
    season: 'autumn',
    academicYear: 2026,
    quotes: {
      content: 'The course is an introduction to procedure-oriented programming in Python.',
      methods:
        'Group activities, exercise lectures and mandatory exercises. In the event of a re-sit examination, the examination may be changed to an oral examination. The re-sit exam will take place in August the following year.',
    },
    workForms: ['lectures', 'exercises', 'project'],
    assessment: [
      {
        form: 'written-exam',
        description: 'School exam',
        weightPercent: 100,
        duration: '4 hours',
      },
    ],
    obligatoryActivities: [{ description: 'Exercises', form: 'assignment' }],
    collaboration: null,
    attendance: null,
    onlineParticipation: null,
    gradeOutcomes: {
      kind: 'dbh',
      fromYear: 2019,
      toYear: 2025,
      sampleSize: 3737,
      failureRatePercent: 2.9,
    },
  },
  {
    code: 'TDT4117',
    term: '2026-autumn',
    title: 'Information Retrieval',
    credits: 7.5,
    language: 'English',
    campuses: ['Trondheim'],
    season: 'autumn',
    academicYear: 2026,
    quotes: {
      content:
        'The course concerns automatic document storage and retrieval. In this case, the term document includes sounds and images as well as text.',
      methods:
        'The course will consist of in-person lectures, tutorial sessions, and assignments. The assignments will consist of problem solving tasks and hands-on programming exercises. The exam is given in English.',
    },
    workForms: ['lectures', 'exercises'],
    assessment: [
      {
        form: 'written-exam',
        description: 'School exam',
        weightPercent: 100,
        duration: '4 hours',
      },
    ],
    obligatoryActivities: [{ description: 'Exercises', form: 'assignment' }],
    collaboration: null,
    attendance: null,
    onlineParticipation: null,
    gradeOutcomes: {
      kind: 'unavailable',
      reason: 'No DBH table 308 observation was fetched for this course.',
    },
  },
  {
    code: 'IT1901',
    term: '2026-autumn',
    title: 'Informatics, Project I',
    credits: 7.5,
    language: 'Norwegian',
    campuses: ['Trondheim'],
    season: 'autumn',
    academicYear: 2026,
    quotes: {
      content:
        'The course gives knowledge and skills in agile application development in teams. The application will use a client server architecture, structured in modules and configured with a build system.',
      methods:
        'Methods of learning: 1) Practical programming tasks 2) Team work and reflection 3) Lectures and presentations by groups. Portfolio evaluation provides the basis for the final grade in the course. Grading is done based on both individual and group submissions.',
    },
    workForms: ['lectures', 'project'],
    assessment: [
      {
        form: 'portfolio',
        description: 'Portfolio assessment',
        weightPercent: 100,
        duration: null,
      },
    ],
    obligatoryActivities: [
      {
        description: 'Exercises, attendance and group contract',
        form: 'assignment',
      },
    ],
    collaboration: 'mixed',
    attendance: 'required',
    onlineParticipation: null,
    gradeOutcomes: {
      kind: 'dbh',
      fromYear: 2019,
      toYear: 2025,
      sampleSize: 1690,
      failureRatePercent: 0.2,
    },
  },
  {
    code: 'TET4180',
    term: '2027-spring',
    title: 'Power System Dynamics and Control',
    credits: 7.5,
    language: 'English',
    campuses: ['Trondheim'],
    season: 'spring',
    academicYear: 2027,
    quotes: {
      content:
        'The course aims to provide advanced knowledge about dynamic behaviour, stability and control in electric power systems.',
      methods:
        'Lectures. Compulsory exercises and computer simulations. Compulsory project work. The course is given in English. The evaluation of this course will be a course portfolio (50%) with adjusting oral exam, and an oral exam (50%). Both the oral exam and portfolio must be passed to receive a grade in the course.',
    },
    workForms: ['lectures', 'exercises', 'project'],
    assessment: [
      {
        form: 'oral-exam',
        description: 'Muntlig eksamen (oral exam)',
        weightPercent: 50,
        duration: '30 minutes',
      },
      {
        form: 'portfolio',
        description: 'Portfolio with oral adjustment',
        weightPercent: 50,
        duration: null,
      },
    ],
    obligatoryActivities: [
      {
        description: 'Compulsory exercises and computer simulations; compulsory project work.',
        form: 'assignment',
      },
    ],
    collaboration: 'mixed',
    attendance: null,
    onlineParticipation: null,
    gradeOutcomes: {
      kind: 'unavailable',
      reason: 'No DBH table 308 observation was fetched for this course.',
    },
  },
  {
    code: 'TDT4290',
    term: '2026-autumn',
    title: 'Customer Driven Project',
    credits: 15,
    language: 'English',
    campuses: ['Trondheim'],
    season: 'autumn',
    academicYear: 2026,
    quotes: {
      content:
        'Each group receives a project assignment from an external client, encompassing all phases of a development project: preliminary analysis, requirements specification, design, implementation, and evaluation.',
      methods:
        'The tasks are completed through group work, with each group consisting of 6-8 members. Weekly meetings with the supervisor are mandatory. Groups will submit a project report and deliver a final presentation and demonstration of a functional system to both the client and the examiner.',
    },
    workForms: ['project'],
    assessment: [
      {
        form: 'project',
        description: 'Work (project report, presentation, and demonstration)',
        weightPercent: 100,
        duration: null,
      },
    ],
    obligatoryActivities: [
      {
        description: 'Weekly meetings with the supervisor are mandatory.',
        form: null,
      },
    ],
    collaboration: 'group',
    attendance: 'required',
    onlineParticipation: null,
    gradeOutcomes: {
      kind: 'dbh',
      fromYear: 2019,
      toYear: 2025,
      sampleSize: 573,
      failureRatePercent: 0.0,
    },
  },
  {
    code: 'TDT4250',
    term: '2026-autumn',
    title: 'Model-Driven Software Engineering',
    credits: 7.5,
    language: 'English',
    campuses: ['Trondheim'],
    season: 'autumn',
    academicYear: 2026,
    quotes: {
      content:
        'Introduction to variability and software product lines. Techniques for the specification of structured models and metamodels. Model-driven development of software, code generation and domain-specific languages.',
      methods:
        'Lectures, exercises and supervised project. The portfolio consist of assignments (30%) on specific topics and a semester project (70%) intended to demonstrate competence on the overall content of the course. Semester project: group work involving 3-5 students.',
    },
    workForms: ['lectures', 'exercises', 'project'],
    assessment: [
      {
        form: 'assignment',
        description: 'Assignments on specific topics',
        weightPercent: 30,
        duration: null,
      },
      {
        form: 'project',
        description: 'Group semester project (3-5 students)',
        weightPercent: 70,
        duration: null,
      },
    ],
    obligatoryActivities: [{ description: 'Exercises', form: 'assignment' }],
    collaboration: 'group',
    attendance: null,
    onlineParticipation: null,
    gradeOutcomes: {
      kind: 'dbh',
      fromYear: 2019,
      toYear: 2025,
      sampleSize: 429,
      failureRatePercent: 16.6,
    },
  },
  {
    code: 'TDT4140',
    term: '2027-spring',
    title: 'Software Engineering',
    credits: 7.5,
    language: 'Norwegian',
    campuses: ['Trondheim'],
    season: 'spring',
    academicYear: 2027,
    quotes: {
      content:
        'Practical and theoretical understanding of software engineering for small, co-located development teams, with special emphasis on development processes, requirements engineering, software quality.',
      methods:
        'Lectures and obligatory group project with several deliverables and presentations. Portfolio assessment forms the basis for the final grade in the course. The portfolio consists of: Preliminary study (5%), Two retrospective reports (15%), Individual reflection report (35%), Group reflection report (45%). Additionally, there are mandatory assignments; a theory test, a group contract, and two oral presentations of a product.',
    },
    workForms: ['lectures', 'project'],
    assessment: [
      {
        form: 'portfolio',
        description:
          'Portfolio assessment: preliminary study (5%), two retrospective reports (15%), individual reflection report (35%), group reflection report (45%)',
        weightPercent: 100,
        duration: '1 semesters',
      },
    ],
    obligatoryActivities: [
      {
        description:
          'Mandatory assignments: a theory test, a group contract, and two oral presentations of a product.',
        form: 'assignment',
      },
    ],
    collaboration: 'mixed',
    attendance: null,
    onlineParticipation: null,
    gradeOutcomes: {
      kind: 'unavailable',
      reason: 'No DBH table 308 observation was fetched for this course.',
    },
  },
  {
    code: 'TDT4100',
    term: '2027-spring',
    title: 'Object-Oriented Programming',
    credits: 7.5,
    language: 'Norwegian',
    campuses: ['Trondheim'],
    season: 'spring',
    academicYear: 2027,
    quotes: {
      content:
        'Basic algorithms and data structures, constructs and control flow in object-oriented languages. Modularization and re-use. Standard application programmers interface (API). Unit testing, error detection.',
      methods:
        'Lectures, exercise lectures, exercises (individually, in pairs and in groups), project work individually or in groups. The mandatory assignments are performed individually or in groups, which will be specified in the semester.',
    },
    workForms: ['lectures', 'exercises', 'project'],
    assessment: [
      {
        form: 'written-exam',
        description: 'Written exam',
        weightPercent: 100,
        duration: '4 hours',
      },
    ],
    obligatoryActivities: [
      {
        description:
          'Assignments performed individually or in groups, which will be specified in the semester.',
        form: 'assignment',
      },
    ],
    collaboration: 'mixed',
    attendance: null,
    onlineParticipation: null,
    gradeOutcomes: {
      kind: 'unavailable',
      reason: 'No DBH table 308 observation was fetched for this course.',
    },
  },
  {
    code: 'TDT4501',
    term: '2026-autumn',
    title: 'Computer Science, Specialization Project',
    credits: 15,
    language: 'English',
    campuses: ['Trondheim'],
    season: 'autumn',
    academicYear: 2026,
    quotes: {
      content: 'Independent project on current topics in Computer Science.',
      methods:
        'Independent project work with guidance, as preparation for the master thesis. Grading based on individual or group project report.',
    },
    workForms: ['project', 'self-study'],
    assessment: [
      {
        form: 'project',
        description: 'Work: project report delivered in Inspera',
        weightPercent: 100,
        duration: null,
      },
    ],
    obligatoryActivities: [],
    collaboration: null,
    attendance: null,
    onlineParticipation: null,
    gradeOutcomes: {
      kind: 'unavailable',
      reason: 'No DBH table 308 observation was fetched for this course.',
    },
  },
  {
    code: 'ENG6024',
    term: '2026-autumn',
    title: 'Literature and Culture in the Classroom',
    credits: 7.5,
    language: 'English',
    campuses: ['Trondheim'],
    season: 'autumn',
    academicYear: 2026,
    quotes: {
      content:
        'This is a didactically oriented course in which the following topics are addressed: reading, ways of reading, and literature and culture in the classroom.',
      methods:
        'The course is offered online with a duration of approximately 11 weeks, and consists of lectures, each within a given topic. Students will maintain contact the teacher and peers through a forum and open course blog. Digital tools will be applied in regard to oral presentations and online meetings. Home exam over 3 days. The course requires submission of 2-4 extensive obligatory assignments. All assignments are evaluated as approved/not approved and will not be part of the final assessment. However, all obligatory course work must be approved for the student to be eligible for the exam.',
    },
    workForms: ['lectures', 'exercises', 'other'],
    assessment: [
      {
        form: 'home-exam',
        description: 'Home examination over 3 days',
        weightPercent: 100,
        duration: '3 days',
      },
    ],
    obligatoryActivities: [
      {
        description:
          '2-4 extensive obligatory assignments, evaluated as approved/not approved; required for exam eligibility.',
        form: 'assignment',
      },
    ],
    collaboration: null,
    attendance: null,
    onlineParticipation: 'available',
    gradeOutcomes: {
      kind: 'unavailable',
      reason: 'No DBH table 308 observation was fetched for this course.',
    },
  },
  {
    code: 'TDT4240',
    term: '2027-spring',
    title: 'Software Architecture',
    credits: 7.5,
    language: 'English',
    campuses: ['Trondheim'],
    season: 'spring',
    academicYear: 2027,
    quotes: {
      content:
        'In the course, the students will learn to define and explain central concepts within software architecture and to use and describe design and architectural patterns.',
      methods:
        'Lectures and exercises. The course will be held in English. The final grade in the course consists of a written school examination (50%) and coursework (50%). The graded works in this course will be carried out in groups.',
    },
    workForms: ['lectures', 'exercises'],
    assessment: [
      {
        form: 'written-exam',
        description: 'Written school examination',
        weightPercent: 50,
        duration: '4 hours',
      },
      {
        form: 'project',
        description: 'Graded coursework carried out in groups',
        weightPercent: 50,
        duration: null,
      },
    ],
    obligatoryActivities: [],
    collaboration: 'group',
    attendance: null,
    onlineParticipation: null,
    gradeOutcomes: {
      kind: 'unavailable',
      reason: 'No DBH table 308 observation was fetched for this course.',
    },
  },
];

const missing = <A>(reason: string): Fact<A> => unknown(reason);

const pageEvidenceFor = (course: CorpusCourse) => ({
  id: `fixture:ntnu-course-page:${course.code}:${course.term}`,
  provider: 'ntnu-course-page',
  kind: 'fixture' as const,
  recordId: `${course.code}:${course.term}`,
  sourceUrl: `https://www.ntnu.edu/studies/courses/${course.code}`,
  sourcePeriod: course.term,
  observedAt,
  excerpt: `Retrieved ${CORPUS_RETRIEVED_AT}. ${course.quotes.content} Teaching: ${course.quotes.methods}`,
  inferenceRule: null,
});

const buildInsight = (course: CorpusCourse): CourseInsight => {
  const coursePageEvidence = pageEvidenceFor(course);
  const coursePageEvidenceId = coursePageEvidence.id;
  const gradesEvidenceId =
    course.gradeOutcomes.kind === 'dbh'
      ? `fixture:dbh-308:${course.code}:${course.gradeOutcomes.fromYear}-${course.gradeOutcomes.toYear}`
      : null;

  const gradesEvidence =
    gradesEvidenceId === null
      ? []
      : [
          {
            id: gradesEvidenceId!,
            provider: 'dbh',
            kind: 'fixture' as const,
            recordId: `table-308:${course.code}`,
            sourceUrl: 'https://dbh-data.dataporten-api.no/Tabeller/hentJSONTabellData',
            sourcePeriod: `${course.gradeOutcomes.kind === 'dbh' ? course.gradeOutcomes.fromYear : ''}–${course.gradeOutcomes.kind === 'dbh' ? course.gradeOutcomes.toYear : ''}`,
            observedAt,
            excerpt: `Retrieved ${CORPUS_RETRIEVED_AT} from public DBH table 308 (institusjonskode 1150), grouped by Emnekode/Karakter/Årstall/Semester over course versions ${course.code}-%.`,
            inferenceRule: null,
          },
        ];

  const encodedInsight = {
    courseKey: `ntnu:${course.code}:${course.term}`,
    institutionCode: 'NTNU' as const,
    code: course.code,
    title: known(course.title, [coursePageEvidenceId]),
    credits: known(course.credits, [coursePageEvidenceId]),
    level: unknown<'bachelor' | 'master' | 'phd' | 'continuing-education' | 'unknown'>(
      'The captured fixture does not map the NTNU study-level label.',
    ),
    teachingLanguage: known(course.language, [coursePageEvidenceId]),
    offerings: known(
      [
        {
          academicYear: course.academicYear,
          season: course.season,
          campuses: [...course.campuses],
          deliveryModes: [],
        },
      ],
      [coursePageEvidenceId],
    ),
    content: known(course.quotes.content, [coursePageEvidenceId]),
    learningOutcomes: unknown<string>(
      'The captured fixture does not quote learning outcomes from the page.',
    ),
    teachingMethods: known(course.quotes.methods, [coursePageEvidenceId]),
    workForms: known([...course.workForms], [coursePageEvidenceId]),
    assessment: known(
      course.assessment.map((part) => ({
        form: part.form,
        description: part.description,
        requirement: missing<'required' | 'optional' | 'choice' | 'conditional'>(
          'The fixture does not state a component requirement rule.',
        ),
        weightPercent: known(part.weightPercent, [coursePageEvidenceId]),
        duration:
          part.duration === null
            ? missing<string>('The ordinary assessment component did not publish a duration.')
            : known(part.duration, [coursePageEvidenceId]),
        workloadPattern: missing<'distributed' | 'concentrated' | 'recurring' | 'milestone'>(
          'Workload timing is not inferred from the assessment form.',
        ),
      })),
      [coursePageEvidenceId],
    ),
    obligatoryActivities: known(
      course.obligatoryActivities.map((activity) => ({
        description: activity.description,
        form:
          activity.form === null
            ? unknown<'assignment' | 'project' | 'portfolio'>(
                'The obligatory activity form could not be classified from source text.',
              )
            : known(activity.form, [coursePageEvidenceId]),
        workloadPattern: missing<'distributed' | 'concentrated' | 'recurring' | 'milestone'>(
          'Workload timing is not inferred from the activity description.',
        ),
      })),
      [coursePageEvidenceId],
    ),
    collaboration:
      course.collaboration === null
        ? missing<'individual' | 'group' | 'mixed'>(
            'The source text does not establish whether obligatory work is individual or collaborative.',
          )
        : known(course.collaboration, [coursePageEvidenceId]),
    attendance:
      course.attendance === null
        ? missing<'required' | 'not-required'>(
            'The source text does not establish an attendance requirement.',
          )
        : known(course.attendance, [coursePageEvidenceId]),
    onlineParticipation:
      course.onlineParticipation === null
        ? missing<'available' | 'not-available'>(
            'The source text does not establish whether remote participation is available.',
          )
        : known(course.onlineParticipation, [coursePageEvidenceId]),
    prerequisites: missing<string>('The fixture does not contain prerequisite evidence.'),
    accessRestrictions: missing<string>('The fixture does not contain access restrictions.'),
    gradeOutcomes:
      course.gradeOutcomes.kind === 'dbh'
        ? {
            period: known(
              { fromYear: course.gradeOutcomes.fromYear, toYear: course.gradeOutcomes.toYear },
              [gradesEvidenceId!],
            ),
            sampleSize: known(course.gradeOutcomes.sampleSize, [gradesEvidenceId!]),
            distribution: unavailable<
              ReadonlyArray<{ grade: string; count: number; percentage: number }>
            >(
              'The grouped DBH observation was aggregated before capture; per-grade buckets were not retained.',
              [gradesEvidenceId!],
            ),
            failureRatePercent: known(course.gradeOutcomes.failureRatePercent, [gradesEvidenceId!]),
            averageGrade: unavailable<string>(
              'The grouped DBH observation does not expose an ordinal average compatible with pass/fail versions.',
              [gradesEvidenceId!],
            ),
            medianGrade: unavailable<string>('The DBH observation does not expose a median.', [
              gradesEvidenceId!,
            ]),
          }
        : {
            period: unavailable<{ fromYear: number; toYear: number }>(course.gradeOutcomes.reason),
            sampleSize: unavailable<number>(course.gradeOutcomes.reason),
            distribution: unavailable<
              ReadonlyArray<{ grade: string; count: number; percentage: number }>
            >(course.gradeOutcomes.reason),
            failureRatePercent: unavailable<number>(course.gradeOutcomes.reason),
            averageGrade: unavailable<string>(course.gradeOutcomes.reason),
            medianGrade: unavailable<string>(course.gradeOutcomes.reason),
          },
    sourceStatuses: [
      {
        provider: 'ntnu-course-page',
        status: 'available' as const,
        observedAt,
        warning:
          'Fixture evidence mapped from the live public course page; not a cached source capture.',
      },
      ...(gradesEvidenceId !== null
        ? [
            {
              provider: 'dbh',
              status: 'available' as const,
              observedAt,
              warning:
                'Fixture evidence summarising a public DBH table 308 query; not a cached source capture.',
            },
          ]
        : []),
    ],
    evidence: [coursePageEvidence, ...gradesEvidence],
  };

  return decodeCourseInsight(encodedInsight);
};

const buildSearchItem = (course: CorpusCourse): CourseSearchItem => {
  const evidence = pageEvidenceFor(course);
  return decodeCourseSearchItem({
    courseKey: `ntnu:${course.code}:${course.term}`,
    institutionCode: 'NTNU' as const,
    code: course.code,
    title: known(course.title, [evidence.id]),
    credits: known(course.credits, [evidence.id]),
    level: unknown('The captured fixture does not map the NTNU study-level label.'),
    offerings: known(
      [
        {
          academicYear: course.academicYear,
          season: course.season,
          campuses: [...course.campuses],
          deliveryModes: [],
        },
      ],
      [evidence.id],
    ),
    assessmentSignals: known(
      [...new Set(course.assessment.map((part) => part.form))],
      [evidence.id],
    ),
    workFormSignals: known([...course.workForms], [evidence.id]),
    enrichment: 'enriched',
    evidence: [evidence],
  });
};

export const corpusCoursesInsights: ReadonlyArray<CourseInsight> = corpusCourses.map(buildInsight);

const insightsByCode = new Map(corpusCoursesInsights.map((insight) => [insight.code, insight]));

export const corpusCourseSearchItems: ReadonlyArray<CourseSearchItem> =
  corpusCourses.map(buildSearchItem);
const gradeSummaries: Readonly<Record<string, CourseGradeSummary>> = Object.fromEntries(
  corpusCourses.flatMap((course) => {
    const summary = course.gradeOutcomes;
    if (summary.kind !== 'dbh') return [];

    const gradesEvidenceId = `fixture:dbh-308:${course.code}:${summary.fromYear}-${summary.toYear}`;
    const gradesEvidence = {
      id: gradesEvidenceId,
      provider: 'dbh',
      kind: 'fixture' as const,
      recordId: `table-308:${course.code}`,
      sourceUrl: 'https://dbh-data.dataporten-api.no/Tabeller/hentJSONTabellData',
      sourcePeriod: `${summary.fromYear}–${summary.toYear}`,
      observedAt,
      excerpt: `Retrieved ${CORPUS_RETRIEVED_AT} from public DBH table 308 (institusjonskode 1150), grouped by Emnekode/Karakter/Årstall/Semester over course versions ${course.code}-%.`,
      inferenceRule: null,
    };
    return [
      [
        course.code,
        decodeCourseGradeSummary({
          courseCode: course.code,
          period: known({ fromYear: summary.fromYear, toYear: summary.toYear }, [gradesEvidenceId]),
          sampleSize: known(summary.sampleSize, [gradesEvidenceId]),
          distribution: unavailable('The grouped DBH observation was aggregated before capture.', [
            gradesEvidenceId,
          ]),
          failureRatePercent: known(summary.failureRatePercent, [gradesEvidenceId]),
          gradingScale: known('letter', [gradesEvidenceId]),
          evidence: [gradesEvidence],
        }),
      ] as const,
    ];
  }),
);

export const corpusGradeSummaryFor = (courseCode: string) =>
  gradeSummaries[courseCode.trim().toUpperCase()] ?? null;

export const corpusDecisionSignalsFor = (courseCode: string) => {
  const course = corpusCourses.find((item) => item.code === courseCode.trim().toUpperCase());
  if (course === undefined) return null;
  const insight = insightsByCode.get(course.code)!;
  const evidence = pageEvidenceFor(course);
  return decodeCourseDecisionSignals({
    courseCode: course.code,
    credits: known(course.credits, [evidence.id]),
    assessment: insight.assessment,
    workFormSignals: insight.workForms,
    obligatoryActivities: insight.obligatoryActivities,
    collaboration: insight.collaboration,
    attendance: insight.attendance,
    onlineParticipation: insight.onlineParticipation,
    sourceStatus: {
      provider: 'ntnu-course-page',
      status: 'available',
      observedAt,
      warning: 'Fixture evidence; live adapter not connected.',
    },
    evidence: [evidence],
  });
};
