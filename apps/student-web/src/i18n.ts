import { Schema as S } from 'effect';

export const supportedLocales = ['en', 'nb'] as const;
export const LocaleSchema = S.Literals(supportedLocales);
export type Locale = (typeof supportedLocales)[number];

export const englishMessages = {
  'app.name': 'Course lens',
  'app.catalogueTitle': 'Browse NTNU courses · Course lens',
  'app.listTitle': 'Your courses · Course lens',
  'app.progressTitle': 'Academic progress · Course lens',
  'app.scheduleTitle': 'Weekly schedule · Course lens',
  'locale.label': 'Language',
  'locale.en': 'English',
  'locale.nb': 'Norsk bokmål',
  'nav.primary': 'Primary navigation',
  'nav.list': 'Saved',
  'nav.schedule': 'Schedule',
  'nav.explore': 'Explore',
  'nav.progress': 'Progress',
  'nav.collapse': 'Collapse sidebar',
  'nav.expand': 'Expand sidebar',
  'nav.claim': 'Facts stay traceable. Missing information stays visible.',
  'appearance.open': 'Open appearance settings',
  'appearance.label': 'Appearance',
  'appearance.navLabel': 'Style',
  'appearance.heading': 'Theme lab',
  'appearance.description':
    'Choose a Nordic palette and how it follows your device. Planning and status colours keep their meaning.',
  'appearance.close': 'Close appearance settings',
  'appearance.palettes': 'Nordic palette',
  'appearance.mode': 'Light and dark mode',
  'appearance.system': 'System',
  'appearance.light': 'Light',
  'appearance.dark': 'Dark',
  'appearance.preview': 'Theme preview',
  'appearance.previewTerm': 'Autumn semester',
  'appearance.previewCredits': '30 credits',
  'appearance.previewCourse': 'Human-centered computing',
  'appearance.previewRequired': 'Required',
  'appearance.previewValid': 'Fits plan',
  'appearance.previewWarning': 'Check overlap',
  'appearance.reset': 'Reset to Fjord',
  'appearance.fjord': 'Fjord',
  'appearance.fjordDescription': 'Clear blues over cool mist.',
  'appearance.aurora': 'Aurora',
  'appearance.auroraDescription': 'Violet light over quiet zinc.',
  'appearance.birch': 'Birch',
  'appearance.birchDescription': 'Warm amber over pale stone.',
  'appearance.heather': 'Heather',
  'appearance.heatherDescription': 'Soft rose over muted mauve.',
  'appearance.pine': 'Pine',
  'appearance.pineDescription': 'The original emerald and olive.',
  'appearance.polarNight': 'Polar night',
  'appearance.polarNightDescription': 'Sky blue over deep neutrals.',
  'catalogue.eyebrow': 'NTNU course catalogue',
  'catalogue.heading': 'Browse courses before you choose.',
  'catalogue.intro':
    'Scan official NTNU offerings, narrow the catalogue, then open a course for assessment, work-form, and grade evidence.',
  'catalogue.searchRegion': 'Find and filter NTNU courses',
  'catalogue.searchLabel': 'Search courses',
  'catalogue.searchPlaceholder': 'Course code or title',
  'catalogue.search': 'Search',
  'catalogue.searching': 'Searching…',
  'catalogue.term': 'Term',
  'catalogue.campus': 'Campus',
  'catalogue.level': 'Study level',
  'catalogue.sort': 'Sort',
  'catalogue.allCampuses': 'All campuses',
  'catalogue.trondheim': 'Trondheim',
  'catalogue.gjovik': 'Gjøvik',
  'catalogue.alesund': 'Ålesund',
  'catalogue.allLevels': 'All levels',
  'catalogue.bachelor': 'Bachelor',
  'catalogue.master': 'Master',
  'catalogue.phd': 'PhD',
  'catalogue.relevance': 'NTNU relevance',
  'catalogue.titleAsc': 'Title A–Z',
  'catalogue.titleDesc': 'Title Z–A',
  'catalogue.codeAsc': 'Code A–Z',
  'catalogue.codeDesc': 'Code Z–A',
  'catalogue.openAdmission': 'Open admission',
  'catalogue.english': 'Taught in English',
  'catalogue.allCourses': 'All NTNU courses',
  'catalogue.activeRefinements': '{count} active refinement{suffix}',
  'catalogue.refineHelp': 'Change search, filters, or sorting from anywhere in the list.',
  'catalogue.refine': 'Refine',
  'catalogue.refineCount': 'Refine · {count}',
  'catalogue.refineHeading': 'Refine courses',
  'catalogue.refineDescription': 'Changes apply immediately and stay in the shareable URL.',
  'catalogue.closeRefinements': 'Close course refinements',
  'catalogue.viewResults': 'View results',
  'catalogue.loading': 'Loading the NTNU catalogue',
  'catalogue.loadingHelp': 'Official course summaries appear before deeper evidence is loaded.',
  'catalogue.unavailable': 'Catalogue unavailable',
  'catalogue.loadFailed': 'We could not load courses',
  'catalogue.retry': 'Your filters are preserved. Submit the search to try again.',
  'catalogue.empty': 'No courses match these filters',
  'catalogue.emptyHelp': 'Try another phrase, campus, term, or study level.',
  'catalogue.results': 'Course results',
  'catalogue.partial':
    'Some catalogue data could not be used. Official results that were validated remain visible.',
  'catalogue.courses': 'Courses',
  'catalogue.showing': 'Showing {shown} of {total} courses',
  'catalogue.official': 'Official NTNU catalogue',
  'catalogue.moreFailed': 'More courses could not be loaded.',
  'catalogue.loadingMore': 'Loading more courses…',
  'catalogue.showMore': 'Show more courses',
  'catalogue.end': 'End of results',
  'course.open': 'Open {code}: {title}',
  'course.titleUnavailable': 'Title unavailable',
  'course.termUnavailable': 'Term unavailable',
  'course.campusUnreported': 'Campus not reported',
  'course.creditsValue': '{value} credits',
  'course.termFact': 'Term',
  'course.campusFact': 'Campus',
  'course.back': '← Back to course results',
  'schedule.eyebrow': 'Weekly schedule',
  'schedule.heading': 'Your saved-course schedule',
  'schedule.intro':
    'Choose saved courses and inspect their dated provider-published activities for one ISO week.',
  'schedule.limitations':
    'Provider-published activities are shown by default. Alternative-session assignment and exception semantics are unavailable.',
  'schedule.week': 'Week number',
  'schedule.weekHelp': 'Choose an ISO week from 1 to {maximum}.',
  'schedule.previousWeek': 'Previous week',
  'schedule.nextWeek': 'Next week',
  'schedule.courses': 'Choose saved courses',
  'schedule.coursesHelp':
    'Choose up to {maximum} saved courses. Your selection stays in this link.',
  'schedule.activities': 'Activities for {code}',
  'schedule.activitiesHelp':
    'Choose which provider-published activities appear in this timetable. This does not identify an assigned session.',
  'schedule.savedCoursesLoading': 'Opening your saved courses…',
  'schedule.noSavedCourses': 'No saved courses are available to choose.',
  'schedule.noSavedCoursesHelp': 'Save a course in Explore, then return here to see its schedule.',
  'schedule.maximumSelected': 'You can choose up to {maximum} courses.',
  'schedule.selectionRequired': 'Choose at least one saved course',
  'schedule.selectionRequiredHelp': 'The schedule stays empty until you choose a saved course.',
  'schedule.loading': 'Loading the weekly schedule',
  'schedule.loadingHelp': 'Published activities are being checked for the chosen week.',
  'schedule.loadFailed': 'We could not load this weekly schedule',
  'schedule.empty': 'No published activities this week',
  'schedule.emptyHelp':
    'The selected available courses have no provider-published activities for this ISO week.',
  'schedule.hiddenActivities': 'All published activities are hidden',
  'schedule.hiddenActivitiesHelp': 'Choose an activity above to show it in the timetable.',
  'schedule.agenda': 'Weekly timetable',
  'schedule.sourceFailed': 'Schedule source failed for {code}',
  'schedule.sourceUnavailable': 'Schedule source unavailable for {code}',
  'schedule.sources': 'Source and freshness',
  'schedule.sourceProvider': 'Provider',
  'schedule.sourceObserved': 'Observed',
  'schedule.activityFallback': 'Activity {code}',
  'schedule.timeRange': '{start}–{end} Oslo time',
  'schedule.status': 'Status',
  'schedule.room': 'Room',
  'list.eyebrow': 'Your courses',
  'list.heading': 'Saved courses and results',
  'list.intro':
    'Saved courses and NTNU results meet here. Results come from your local Progress history and never become bookmarks by themselves.',
  'list.backToExplore': 'Browse more courses',
  'list.loading': 'Opening your courses',
  'list.loadingHelp':
    'Saved courses and local results are read from this browser before the list is shown.',
  'list.density': 'Display',
  'list.densityCard': 'Card',
  'list.densityCompact': 'Compact',
  'list.originFilter': 'Course source',
  'list.originAll': 'All {count}',
  'list.originSaved': 'Saved {count}',
  'list.originResults': 'Results {count}',
  'list.rowOrigins': 'Sources for {code}',
  'list.resultBadge': 'Result',
  'list.savedBadge': 'Saved',
  'list.resultOnlyHelp': 'Save this course to add labels and a private note.',
  'list.resultEvidence': 'Latest local result',
  'list.resultEvidenceHelp': 'From your local Progress history, not current course documentation.',
  'list.resultSummary': '{grade} · {term} {year} · {credits} credits',
  'list.courseCountOne': '1 course',
  'list.courseCountMany': '{count} courses',
  'list.countOne': '1 saved course',
  'list.countMany': '{count} saved courses',
  'list.empty': 'You have no saved courses or NTNU results yet',
  'list.emptyHelp': 'Save a course in Explore, or add an NTNU result in Progress.',
  'list.saveCourse': 'Save {code} to List',
  'list.removeCourse': 'Remove {code} from List',
  'list.save': 'Save',
  'list.remove': 'Remove',
  'list.savePending': 'Saved courses are still loading',
  'list.savePaused': 'Saving is paused until the stored list is recovered or reset.',
  'list.savePausedLink': 'Open List to recover saved courses',
  'list.factsNotLoaded': 'Course details were not loaded in this session.',
  'list.factsNotLoadedHelp':
    'Open the course to load assessment, work, and historical outcome evidence.',
  'list.note': 'Your note',
  'list.notePlaceholder': 'Why this course is interesting, questions to ask, conflicts to check',
  'list.noteHelp':
    'Private to this device. Notes are written by you and never count as course evidence.',
  'list.saveNote': 'Save note',
  'list.openCourse': 'Open {code}',
  'list.repaired': 'Unusable saved entries were removed: {count}.',
  'list.recoveryHeading': 'Saved courses could not be loaded',
  'list.recoveryUnsupported':
    'This browser stored a newer version of the saved list (version {version}). Update the application, or reset the list to start again on this device.',
  'list.recoveryCorrupt': 'The stored saved list could not be read.',
  'list.recoveryUnavailable':
    'This browser did not allow local storage, so saved courses are unavailable here.',
  'list.recoveryKept':
    'Nothing was deleted. The stored value is kept below so you can copy it before resetting.',
  'list.recoveryShowStored': 'Show the stored value',
  'list.reset': 'Reset saved courses',
  'list.resetHelp': 'Resetting permanently deletes the stored list on this device.',
  'list.persistFailed':
    'The last change to your saved courses could not be stored in this browser.',
  'list.savedStatus': '{code} saved to List.',
  'list.removedStatus': '{code} removed from List.',
  'list.removedManyStatus': '{count} courses removed from List.',
  'list.dismissAllStatus': 'Dismiss all {count}',
  'list.undo': 'Undo',
  'list.undoSave': 'Undo saving {code}',
  'list.undoRemove': 'Undo removing {code}',
  'list.undoRemoveMany': 'Undo removing {count} courses',
  'list.dismissStatus': 'Dismiss',
  'list.labels': 'Labels',
  'list.labelsHeading': 'Your labels',
  'list.labelsHelp':
    'Labels are your own words for your own plans. They never change course facts and never count as evidence.',
  'list.labelsForCourse': 'Labels for {code}',
  'list.labelsForSelection': 'Labels for {count} selected saved courses',
  'list.labelsManageOnly': 'Create and edit labels',
  'list.openLabels': 'Labels',
  'list.editLabelsFor': 'Edit labels for {code}',
  'list.closeLabels': 'Close labels',
  'list.labelName': 'Label name',
  'list.labelNamePlaceholder': 'Autumn 2027, Ask adviser, Remote candidates',
  'list.labelColor': 'Label colour',
  'list.addLabel': 'Add label',
  'list.saveLabel': 'Save label',
  'list.cancelLabelEdit': 'Cancel editing',
  'list.editLabel': 'Edit label',
  'list.deleteLabel': 'Delete label',
  'list.labelRowActions': 'Actions for {name}',
  'list.deleteLabelConfirm':
    'Delete "{name}"? Saved courses keep their identity; only the label is removed.',
  'list.cancelDeleteLabel': 'Cancel deleting',
  'list.labelCountUnit': 'saved courses',
  'list.labelCountUnitOne': 'saved course',
  'list.filterExcludedBadge': 'Excluded',
  'list.noLabels': 'You have not created a label yet.',
  'list.labelOnCourse': 'On {code}',
  'list.labelPartlyOnSelection': 'On {matched} of {count} selected',
  'list.labelDuplicate': 'A label with that name already exists.',
  'list.labelEmptyName': 'Give the label a name first.',
  'list.labelLimit': 'The maximum is {count} labels. Delete one to add another.',
  'list.labelUnknownError': 'That label no longer exists.',
  'list.rowLabels': 'Labels on {code}',
  'list.rowNoLabels': 'No labels yet',
  'compare.heading': 'Compare saved courses',
  'compare.intro': 'Only what differs is shown. Facts the sources did not report stay named.',
  'compare.close': 'Close comparison',
  'compare.open': 'Compare',
  'compare.differencesOnly': 'Differences',
  'compare.showAll': 'Show all',
  'compare.dimension': 'Dimension',
  'compare.notLoaded': 'Not loaded',
  'compare.none': 'None',
  'compare.activityCount': '{count} activities',
  'compare.credits': 'Credits',
  'compare.term': 'Term',
  'compare.campus': 'Campus',
  'compare.assessment': 'Assessment',
  'compare.obligatory': 'Obligatory work',
  'compare.collaboration': 'Collaboration',
  'compare.outcomeScale': 'Outcome scale',
  'compare.failureRate': 'Failure rate',
  'compare.sample': 'Sample',
  'compare.period': 'Observed period',
  'compare.identical': 'Every remaining dimension is identical across these courses.',
  'list.filterHeading': 'Filter by label',
  'list.filterCombine': 'Combine labels',
  'list.filterMode': 'Match included labels',
  'list.filterModeAny': 'Any',
  'list.filterModeAll': 'All',
  'list.filterIncludeHeading': 'Include labels',
  'list.filterExcludeHeading': 'Exclude labels',
  'list.filterExcludeHelp': 'Excluding several labels removes a course carrying any of them.',
  'list.filterExclude': 'Exclude {name}',
  'list.filterClear': 'Clear label filter',
  'list.filterSummaryInclude': 'Showing saved courses in {labels}.',
  'list.filterSummaryExclude': 'Showing saved courses, excluding {excluded}.',
  'list.filterSummaryBoth': 'Showing saved courses in {labels}, excluding {excluded}.',
  'list.filterSummaryNone': 'Showing every saved course.',
  'list.filterContradiction':
    '{labels} stays excluded, so it was removed from the included labels.',
  'feedback.prompt': 'Did this help your decision? ',
  'feedback.action': 'Tell us',
  'feedback.optional': ' — completely optional.',
  'list.filterUnknownDropped':
    'The filter referred to labels that no longer exist. They were removed: {count}.',
  'list.filterUnlabeled': 'Unlabeled',
  'list.filterUnsatisfiable':
    '{unlabeled} means no label at all, so All can never match it together with a label. Switch to Any, or remove one of them.',
  'list.filteredCount': 'Showing {shown} of {total} courses',
  'list.filterEmpty': 'No courses match these filters',
  'list.filterEmptyHelp': 'Change the filters, or clear them to see every course.',
  'list.filtersClear': 'Clear filters',
  'list.selectCourse': 'Select {code}',
  'list.selectionTray': 'Selected saved courses',
  'list.selectionCount': '{count} selected',
  'list.selectionCountOne': '1 selected',
  'list.selectionAddLabels': 'Add labels',
  'list.selectionClear': 'Clear selection',
  'list.selectionRemove': 'Remove selected',
  'list.selectionRemoveConfirm': 'Remove {count} saved courses, with their notes and labels?',
  'list.selectionRemoveConfirmAction': 'Yes, remove them',
  'list.selectionRemoveCancel': 'Keep them',
  'label.colorViolet': 'Violet',
  'label.colorAmber': 'Amber',
  'label.colorRose': 'Rose',
  'label.colorEmerald': 'Emerald',
  'label.colorSky': 'Sky',
  'signals.heading': 'Assessment & work',
  'signals.gradedAssessment': 'Graded assessment',
  'signals.checking': 'Checking the NTNU course page…',
  'signals.failed': 'Course-work signals unavailable',
  'signals.waiting': 'Waiting to check',
  'signals.missing': 'No course-work signals',
  'signals.inferred': 'Inferred from NTNU course text',
  'signals.writtenExam': 'Written exam',
  'signals.oralExam': 'Oral exam',
  'signals.homeExam': 'Home exam',
  'signals.project': 'Project',
  'signals.portfolio': 'Portfolio',
  'signals.practical': 'Practical',
  'signals.assignment': 'Assignment',
  'signals.otherAssessment': 'Other assessment',
  'signals.obligatory': 'Obligatory work',
  'signals.noObligatory': 'No obligatory work reported',
  'signals.individual': 'Individual work',
  'signals.group': 'Group work',
  'signals.mixedCollaboration': 'Individual + group work',
  'signals.required': 'Required',
  'signals.graded': 'graded',
  'signals.ungraded': 'Ungraded',
  'signals.oneActivity': '1 activity',
  'signals.activityCount': '{count} activities',
  'signals.noneReported': 'None reported',
  'outcomes.heading': 'Historical outcomes',
  'outcomes.source': 'HK-dir (DBH)',
  'outcomes.checking': 'Checking HK-dir…',
  'outcomes.failed': 'Grade check unavailable',
  'outcomes.waiting': 'Waiting to check',
  'outcomes.missing': 'No grade summary',
  'outcomes.view': 'Choose historical outcome scale',
  'outcomes.letter': 'Letter grades',
  'outcomes.passFail': 'Pass/fail',
  'outcomes.mixed': 'Mixed scales',
  'outcomes.available': 'Historical outcomes available',
  'outcomes.noBuckets': 'No assessed grade buckets were returned',
  'outcomes.protected': 'Small counts are privacy protected',
  'outcomes.conflicting': 'Published outcome sources conflict',
  'outcomes.unknown': 'Outcome distribution has not been established',
  'outcomes.unavailable': 'No published outcome distribution',
  'outcomes.failedRate': '{value}% failed',
  'outcomes.sample': 'n={value}',
  'outcomes.chartLabel': 'HK-dir DBH historical outcomes. {summary}',
  'outcomes.percent': '{label} {value} percent',
  'outcomes.pass': 'Pass',
  'outcomes.fail': 'Fail',
  'detail.aria': '{code} course details',
  'detail.titleUnavailable': 'Course title unavailable',
  'detail.loading': 'Gathering course evidence',
  'detail.loadingHelp': 'Official course details and historical outcomes load independently.',
  'detail.unavailable': 'Course unavailable',
  'detail.loadFailed': 'We could not load this course',
  'detail.partial': 'Partial result',
  'detail.partialHelp':
    'One source is unavailable. Course details from other sources are still shown, and missing outcomes are not treated as zero.',
  'detail.complete': 'All configured sources responded.',
  'detail.credits': 'Credits',
  'detail.level': 'Level',
  'detail.language': 'Language',
  'detail.availability': 'Availability',
  'detail.availabilityHelp': 'When and where the course is offered.',
  'detail.termLocation': 'Teaching term and location',
  'detail.learn': 'What you will learn',
  'detail.learnHelp': 'Course content and intended learning outcomes.',
  'detail.content': 'Content',
  'detail.learningOutcomes': 'Learning outcomes',
  'detail.works': 'How the course works',
  'detail.worksHelp': 'Teaching, collaboration, attendance, and participation evidence.',
  'detail.teachingMethods': 'Teaching methods',
  'detail.workForms': 'Work forms',
  'detail.collaboration': 'Collaboration',
  'detail.attendance': 'Attendance',
  'detail.online': 'Online participation',
  'detail.assessment': 'Assessment and obligatory work',
  'detail.assessmentHelp': 'What counts toward the grade and what must be approved first.',
  'detail.assessmentFact': 'Assessment',
  'detail.assessmentWeight': 'Grade weight',
  'detail.obligatory': 'Obligatory activities',
  'detail.approvalGate': 'must be approved before assessment',
  'detail.requirements': 'Requirements',
  'detail.requirementsHelp': 'Recommended background and access constraints.',
  'detail.prerequisites': 'Prerequisites',
  'detail.access': 'Access restrictions',
  'detail.inferred': 'Inferred',
  'detail.conflicting': 'Conflicting',
  'detail.gradeOutcomes': 'Grade outcomes',
  'detail.gradeHelp':
    'Historical outcomes describe past cohorts; they do not predict an individual result.',
  'detail.examParticipation': 'Exam activity',
  'detail.examParticipationHelp':
    'Official DBH totals show exam registrations and outcomes. They do not count unique students.',
  'detail.examRegistrations': '{count} registrations',
  'detail.registered': 'Registered',
  'detail.attended': 'Attended',
  'detail.passed': 'Passed',
  'detail.failed': 'Failed',
  'detail.passedAfterRepeat': 'Passed after a repeat attempt',
  'detail.coveredPeriod': 'Covered period',
  'detail.sampleSize': 'Sample size',
  'detail.results': '{count} results',
  'detail.failureRate': 'Failure rate',
  'detail.averageGrade': 'Average grade',
  'detail.medianGrade': 'Median grade',
  'detail.distribution': 'Grade distribution',
  'detail.distributionCaption': 'Historical grade distribution',
  'detail.grade': 'Grade',
  'detail.count': 'Count',
  'detail.share': 'Share',
  'detail.sources': 'Sources and freshness',
  'detail.sourcesHelp':
    'Each fact links to the live source capture or derivation used for this response. Fixture data is labelled explicitly.',
  'detail.noObservation': 'No observation time',
  'detail.observed': 'Observed {date}',
  'detail.noSourcePeriod': 'No source period',
  'detail.observedInline': '{period} · observed {date}',
  'detail.noExternalLink': 'No external source link',
  'detail.openSource': 'Open source ↗',
  'detail.noEvidence': 'No supporting evidence',
  'detail.supportingEvidence': 'Supporting evidence',
  'detail.viewEvidence': 'View evidence',
  'detail.viewEvidenceLabel': 'View evidence {id}',
  'detail.deliveryUnknown': 'Delivery mode unknown',
  'detail.noneReported': 'None reported.',
  'offering.academicYear': 'Academic year {year}',
  'footer.licensePrefix':
    'Copyright © Course Data Platform contributors. Free software licensed under ',
  'footer.licenseSuffix': '; provided without warranty.',
  'footer.useful': 'Found this useful? ',
  'footer.optional': ' — completely optional.',
  'footer.license':
    'Copyright © Course Data Platform contributors. Free software licensed under {license}; provided without warranty.',
  'footer.licenseName': 'AGPL-3.0-only',
  'footer.source': 'View source code',
  'footer.tip': 'Support the project',
  'progress.label': 'Progress',
  'progress.heading': 'Your academic progress',
  'progress.description':
    'Import a result history PDF from this browser to review your completed courses. Your records stay on this device and are never official documentation.',
  'progress.loading': 'Loading your progress',
  'progress.recoveryHeading': 'Your progress history could not be loaded',
  'progress.recoveryDescription':
    'The saved progress history could not be read. Nothing has been changed.',
  'progress.recoveryUnavailableHeading': 'Local storage is unavailable',
  'progress.recoveryUnavailableDescription':
    'This browser cannot save your progress history. You can still review an import during this visit.',
  'progress.recoveryReset': 'Reset progress history',
  'progress.persistenceFailed':
    'The last change to your progress history could not be saved in this browser.',
  'progress.persistenceSaving': 'Saving progress history…',
  'progress.summaryHeading': 'Progress summary',
  'progress.weightedAverage': 'Credit-weighted average',
  'progress.noAverage': 'No graded courses included',
  'progress.earnedCredits': 'Earned credits',
  'progress.gradedCredits': 'Graded credits',
  'progress.includedCourses': 'Included courses',
  'progress.creditsValue': '{credits} credits',
  'progress.courseCountOne': '{count} included course',
  'progress.courseCountMany': '{count} included courses',
  'progress.calculatorHeading': 'Average settings',
  'progress.calculatorDescription':
    'Choose how retakes and failing grades are included in the credit-weighted average.',
  'progress.retakePolicy': 'Retake policy',
  'progress.retakeLatest': 'Use latest result',
  'progress.retakeBest': 'Use best result',
  'progress.includeF': 'Include F grades in average',
  'progress.importHeading': 'Import result history',
  'progress.importDescription':
    'Choose a PDF result history from this device. It is read locally and is not uploaded or saved.',
  'progress.importChoose': 'Choose PDF',
  'progress.importDropHint': 'or drop one PDF here',
  'progress.importRequirements': 'PDF only · up to 10 MiB · 1–30 pages',
  'progress.importParsing': 'Reading {fileName} locally…',
  'progress.importNonFile': 'Choose a file to import.',
  'progress.importOneFile': 'Choose one PDF file.',
  'progress.importPdfOnly': 'Choose a PDF file.',
  'progress.importFailed': 'The PDF could not be read as a result history.',
  'progress.importRetry': 'Try another file',
  'progress.reviewHeading': 'Review imported results',
  'progress.reviewDescription':
    'Confirm the student-authored rows to add to your local progress history.',
  'progress.reviewFile': 'File: {fileName}',
  'progress.reviewInstitution': 'Issuing institution: {institution}',
  'progress.reviewInstitutionUnknown': 'Issuing institution not found',
  'progress.reviewWarningsHeading': 'Review warnings',
  'progress.reviewSelectAll': 'Select all',
  'progress.reviewSelectNone': 'Select none',
  'progress.reviewSelection': '{count} selected',
  'progress.reviewApprove': 'Add selected results',
  'progress.reviewCancel': 'Cancel import',
  'progress.reviewNoRows': 'No course results were found in this PDF.',
  'progress.reviewNoSelection': 'Select at least one result to add it.',
  'progress.importConflict': 'The import has conflicting results for the same course and semester.',
  'progress.resultCourse': 'Course',
  'progress.resultSemester': 'Semester',
  'progress.resultGrade': 'Grade',
  'progress.resultCredits': 'Credits',
  'progress.resultStatedCredits': 'Stated credits',
  'progress.resultInclude': 'Include',
  'progress.historyHeading': 'Your history',
  'progress.historyDescription':
    'These are local records you have added. They are not official course evidence.',
  'progress.emptyHeading': 'No results yet',
  'progress.emptyDescription':
    'Import a result-history PDF to calculate your credit-weighted average.',
  'progress.removeResult': 'Remove {courseCode}',
  'progress.remove': 'Remove',
  'progress.gradePass': 'Pass',
  'progress.gradeFail': 'Fail',
  'progress.gradeRecognized': 'Recognized',
  'progress.retrySave': 'Try saving again',
  'progress.previewHeading': 'Inspect the original PDF',
  'progress.previewDescription':
    'The document stays in this browser. Check that it is the right transcript before Course lens reads it.',
  'progress.previewReady': 'Original document preview',
  'progress.previewParse': 'Read results from this PDF',
  'progress.previewCancel': 'Cancel',
  'progress.reviewSource': 'View original PDF',
  'progress.reviewBack': 'Back to imported results',
  'progress.reviewEdit': 'Edit imported rows',
  'progress.reviewDoneEditing': 'Finish editing',
  'progress.reviewDraftChanged': 'Draft changed. Saved progress is unchanged until approval.',
  'progress.reviewDraftUnchanged': 'Draft only. Saved progress is unchanged until approval.',
  'progress.reviewRowError': 'This selected row must be corrected before approval.',
  'progress.reviewNew': 'New result',
  'progress.reviewUpdate': 'Updates the saved result from this semester',
  'progress.reviewUnchanged': 'Already saved with the same values',
  'progress.reviewPrevious': 'Kept as an earlier attempt',
  'progress.fieldInstitution': 'Institution',
  'progress.fieldCode': 'Course code',
  'progress.fieldName': 'Course name',
  'progress.fieldYear': 'Year',
  'progress.fieldTerm': 'Term',
  'progress.fieldCredits': 'Credits',
  'progress.fieldGrade': 'Grade',
  'progress.termSpring': 'Spring',
  'progress.termAutumn': 'Autumn',
  'progress.addCourse': 'Add course result',
  'progress.editCourse': 'Edit {courseCode}',
  'progress.editorDescription':
    'Changes stay in this draft until you save them. Credits use a decimal number; term uses 1 for spring or 2 for autumn.',
  'progress.editorUnsaved': 'Unsaved draft changes',
  'progress.editorValidation': 'Correct the highlighted fields before saving.',
  'progress.saveCourse': 'Save course',
  'progress.cancelEdit': 'Cancel editing',
  'progress.discardHeading': 'Discard these changes?',
  'progress.discardDescription': 'Continue editing to keep the draft.',
  'progress.keepEditing': 'Continue editing',
  'progress.discardChanges': 'Discard changes',
  'progress.removeCourseHeading': 'Remove this course and its earlier attempts?',
  'progress.removeCourseDescription': 'This course change can be undone during this session.',
  'progress.confirmRemove': 'Remove course',
  'progress.searchLabel': 'Find a course in your progress',
  'progress.searchPlaceholder': 'Course code, title, or institution',
  'progress.searchCount': 'Showing {shown} of {total} courses',
  'progress.searchEmpty': 'No courses match this search.',
  'progress.openCourse': 'Open {courseCode} in Course lens',
  'progress.targetHeading': 'Toward your credit target',
  'progress.targetLabel': 'Credit target',
  'progress.targetApply': 'Update target',
  'progress.targetRemaining': '{credits} credits remain.',
  'progress.targetComplete': 'You have reached this credit target.',
  'progress.targetHelp':
    'This is a credit overview. Your institution decides whether the course combination completes a degree.',
  'progress.distributionHeading': 'Grade distribution',
  'progress.distributionDescription':
    'Credits by selected grade. Pass and recognized results earn credits but do not affect the letter-grade average.',
  'progress.semesterHeading': 'Average over time',
  'progress.semesterDescription':
    'Each row shows the cumulative credit-weighted average through that semester.',
  'progress.previousHeading': 'Earlier attempts',
  'progress.previousDescription':
    'Earlier attempts are retained on this device. The selected retake rule decides which attempt enters the average.',
  'progress.previousCountOne': '1 earlier attempt',
  'progress.previousCountMany': '{count} earlier attempts',
  'progress.receiptsHeading': 'Import history',
  'progress.receiptsDescription': 'Approved imports recorded on this device.',
  'progress.receiptsEmpty': 'No approved imports yet.',
  'progress.receiptSummary': '{courses} results · {credits} earned credits · average {average}',
  'progress.dataHeading': 'Your local data',
  'progress.dataDescription':
    'Move your records with a versioned JSON backup. PDF files and in-session undo history are never included.',
  'progress.backupDownload': 'Download backup',
  'progress.backupDownloaded': 'Backup downloaded.',
  'progress.backupFailed': 'The backup could not be downloaded.',
  'progress.backupRestoreHeading': 'Restore this backup?',
  'progress.backupRestoreDescription':
    'This replaces results, settings, target, and import history on this device.',
  'progress.backupRestore': 'Restore backup',
  'progress.backupRestored': 'Backup restored.',
  'progress.clearRequest': 'Delete local progress',
  'progress.clearHeading': 'Delete progress from this device?',
  'progress.clearDescription':
    'Results, settings, import history, and the current undo history will be deleted. Download a backup first if you need them.',
  'progress.clearConfirm': 'Delete local progress',
  'progress.confirmCancel': 'Keep my data',
  'progress.exampleLoad': 'View example progress',
  'progress.exampleHeading': 'Replace current progress with example data?',
  'progress.exampleDescription':
    'Download a backup first if you want to keep your current records.',
  'progress.exampleConfirm': 'Load example',
  'progress.calculationHeading': 'How the average is calculated',
  'progress.calculationFormula': 'Σ (grade points × credits) ÷ Σ graded credits',
  'progress.calculationDescription':
    'A=5, B=4, C=3, D=2, E=1, and F=0 when failures are included. Pass, fail, and recognized results do not add graded credits.',
  'progress.calculationDisclaimer':
    'This is a descriptive Norwegian A–F calculation, not an official admission average or US GPA.',
  'progress.sessionHeading': 'Changes in this session',
  'progress.sessionDescription':
    'Undo and redo move between course changes. Calculation settings and the credit target stay unchanged.',
  'progress.sessionUndo': 'Undo',
  'progress.sessionRedo': 'Redo',
  'progress.sessionStart': 'Start of session',
  'progress.sessionCurrent': 'Current',
  'progress.sessionUndone': 'Undone',
  'progress.sessionEmpty': 'No course changes in this session.',
  'progress.restoreInvalid': 'The selected file is not a supported progress backup.',
  'progress.fileType': 'PDF transcript or Course lens JSON backup',
  'progress.statusCourseSaved': 'Course result saved.',
  'progress.statusImportSaved': 'Imported results saved.',
  'progress.statusCleared': 'Local progress deleted.',
  'progress.staleDraft':
    'Your progress changed after this draft opened. Close it and start again so no newer change is overwritten.',
  'progress.targetProgress': '{earned} of {target} credits earned',
  'progress.targetProgressLabel': 'Progress toward credit target',
  'progress.noTrend': 'Add graded results to see the average over time.',
  'progress.importSupportedOnly': 'Choose one PDF transcript or Course lens JSON backup.',
  'progress.importOpening': 'Opening {fileName} locally…',
  'progress.timelineImport': 'Imported results',
  'progress.timelineAdd': 'Added a result',
  'progress.timelineEdit': 'Edited a result',
  'progress.timelineRemove': 'Removed a result',
  'progress.timelineRestore': 'Restored a backup',
  'progress.timelineCourses': '{count} results after this change',
  'progress.vocabularyHeading': 'Additional transcript labels',
  'progress.vocabularyDescription':
    'Add labels only when a transcript uses wording that the importer does not recognize. These settings apply to the next PDF in this browser tab.',
  'progress.vocabularyTerms': 'Term labels',
  'progress.vocabularyTermsHelp': 'One per line as label=1 for spring or label=2 for autumn.',
  'progress.vocabularyGrades': 'Grade labels',
  'progress.vocabularyGradesHelp': 'One per line as label=A–F, pass, fail, or recognized.',
  'progress.vocabularyTotals': 'Total-credit labels',
  'progress.vocabularyTotalsHelp': 'One label per line, for example “ECTS total”.',
  'progress.vocabularyInvalid': 'Correct the additional transcript labels before reading the PDF.',
  'progress.editResult': 'Edit course result',
} as const;

export type MessageKey = keyof typeof englishMessages;
export type MessageCatalogue = Readonly<Record<MessageKey, string>>;

/**
 * Dynamic catalogues are indexed by this English baseline. The module that
 * loads a locale only carries values, not message keys, so it cannot make the
 * production entry chunk retain another language's strings.
 */
export const messageKeys = Object.freeze(
  Object.keys(englishMessages) as Array<MessageKey>,
) as ReadonlyArray<MessageKey>;

const messageIndexes: Readonly<Record<MessageKey, number>> = Object.freeze(
  Object.fromEntries(messageKeys.map((key, index) => [key, index])) as Record<MessageKey, number>,
);

export const IndexedMessageCatalogueSchema = S.Array(S.String);
export type IndexedMessageCatalogue = typeof IndexedMessageCatalogueSchema.Type;

const TokenTranslationSchema = S.Struct({
  token: S.String,
  message: S.String,
});
export const TokenCatalogueSchema = S.Array(TokenTranslationSchema);
export type TokenCatalogue = typeof TokenCatalogueSchema.Type;

/**
 * Locale-specific data remains explicit application state. English needs no
 * payload; the optional payload is the loaded Norwegian catalogue.
 */
export const Localization = S.Struct({
  locale: LocaleSchema,
  messages: S.optional(IndexedMessageCatalogueSchema),
  tokens: S.optional(TokenCatalogueSchema),
});
export type Localization = typeof Localization.Type;

export const encodeMessageCatalogue = (catalogue: MessageCatalogue): IndexedMessageCatalogue =>
  messageKeys.map((key) => catalogue[key]);

const interpolationNames = (message: string): ReadonlyArray<string> =>
  [...message.matchAll(/\{([a-z][a-zA-Z0-9]*)\}/g)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined)
    .sort();

/**
 * Kept independent of dynamic imports so the validator can load both complete
 * source catalogues directly without pulling Norwegian strings into the app.
 */
export const validateMessageCatalogues = (
  catalogues: Readonly<Record<Locale, MessageCatalogue>>,
): ReadonlyArray<string> => {
  const issues: Array<string> = [];

  for (const locale of supportedLocales) {
    const catalogue = catalogues[locale];
    for (const key of messageKeys) {
      const message = catalogue[key];
      if (message === undefined) {
        issues.push(`${locale}: missing message "${key}"`);
        continue;
      }
      const expected = interpolationNames(englishMessages[key]);
      const actual = interpolationNames(message);
      if (expected.join('|') !== actual.join('|')) {
        issues.push(
          `${locale}: interpolation variables for "${key}" must be ${expected.join(', ') || '(none)'}`,
        );
      }
    }
    for (const key of Object.keys(catalogue)) {
      if (messageIndexes[key as MessageKey] === undefined) {
        issues.push(`${locale}: unknown message "${key}"`);
      }
    }
  }
  return issues;
};

export const isLocale = (value: string | null | undefined): value is Locale =>
  value === 'en' || value === 'nb';

export const localeTag = (locale: Locale): 'en-GB' | 'nb-NO' =>
  locale === 'nb' ? 'nb-NO' : 'en-GB';

export const translate = (
  localization: Localization,
  key: MessageKey,
  parameters: Readonly<Record<string, string | number>> = {},
): string => {
  const localizedMessage =
    localization.locale === 'nb' ? localization.messages?.[messageIndexes[key]] : undefined;
  let message = localizedMessage ?? englishMessages[key];
  for (const [name, value] of Object.entries(parameters)) {
    message = message.replaceAll(`{${name}}`, String(value));
  }
  return message;
};

export const translateToken = (localization: Localization, value: string): string =>
  (localization.locale === 'nb'
    ? localization.tokens?.find((translation) => translation.token === value)?.message
    : undefined) ??
  value
    .split('-')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
