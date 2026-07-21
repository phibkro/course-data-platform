import {
  restoreScenario,
  serializeScenario,
  type PlanningScenario,
} from '@course-data/study-kernel';

const DATABASE_NAME = 'course-data-platform';
const DATABASE_VERSION = 1;
const SCENARIO_STORE = 'planning-scenarios';
const PREFERENCE_STORE = 'planner-preferences';
const PREFERENCE_KEY = 'active-planner-context';
const EXPORT_FORMAT = 'course-data-planning-scenario';

export interface PlannerPreferences {
  readonly selectedProgrammeVersionId: string | null;
  readonly activeScenarioId: string | null;
}

interface StoredScenario {
  readonly id: string;
  readonly programmeVersionId: string;
  readonly savedAt: string;
  readonly scenario: PlanningScenario;
}

interface StoredPreferences extends PlannerPreferences {
  readonly id: typeof PREFERENCE_KEY;
}

interface ScenarioEnvelope {
  readonly format: typeof EXPORT_FORMAT;
  readonly version: 1;
  readonly exportedAt: string;
  readonly scenario: PlanningScenario;
}

const defaultPreferences: PlannerPreferences = {
  selectedProgrammeVersionId: null,
  activeScenarioId: null,
};

const requestResult = <A>(request: IDBRequest<A>): Promise<A> =>
  new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('IndexedDB request failed')),
    );
  });

const transactionComplete = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve());
    transaction.addEventListener('abort', () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted')),
    );
    transaction.addEventListener('error', () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed')),
    );
  });

const openDatabase = (): Promise<IDBDatabase> => {
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.addEventListener('upgradeneeded', () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(SCENARIO_STORE)) {
      const scenarios = database.createObjectStore(SCENARIO_STORE, { keyPath: 'id' });
      scenarios.createIndex('programmeVersionId', 'programmeVersionId', { unique: false });
    }
    if (!database.objectStoreNames.contains(PREFERENCE_STORE)) {
      database.createObjectStore(PREFERENCE_STORE, { keyPath: 'id' });
    }
  });
  return requestResult(request);
};

const withDatabase = async <A>(run: (database: IDBDatabase) => Promise<A>): Promise<A> => {
  const database = await openDatabase();
  try {
    return await run(database);
  } finally {
    database.close();
  }
};

export const listScenarios = async (
  programmeVersionId?: string,
): Promise<ReadonlyArray<PlanningScenario>> =>
  withDatabase(async (database) => {
    const transaction = database.transaction(SCENARIO_STORE, 'readonly');
    const store = transaction.objectStore(SCENARIO_STORE);
    const request = programmeVersionId
      ? store.index('programmeVersionId').getAll(programmeVersionId)
      : store.getAll();
    const records = (await requestResult(request)) as StoredScenario[];
    await transactionComplete(transaction);
    return records
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
      .map((record) => restoreScenario(serializeScenario(record.scenario)));
  });

export const saveScenario = async (scenario: PlanningScenario): Promise<void> =>
  withDatabase(async (database) => {
    const transaction = database.transaction(SCENARIO_STORE, 'readwrite');
    transaction.objectStore(SCENARIO_STORE).put({
      id: scenario.id,
      programmeVersionId: scenario.programmeVersionId,
      savedAt: new Date().toISOString(),
      scenario,
    } satisfies StoredScenario);
    await transactionComplete(transaction);
  });

export const deleteScenario = async (scenarioId: string): Promise<void> =>
  withDatabase(async (database) => {
    const transaction = database.transaction(SCENARIO_STORE, 'readwrite');
    transaction.objectStore(SCENARIO_STORE).delete(scenarioId);
    await transactionComplete(transaction);
  });

export const loadPlannerPreferences = async (): Promise<PlannerPreferences> =>
  withDatabase(async (database) => {
    const transaction = database.transaction(PREFERENCE_STORE, 'readonly');
    const stored = (await requestResult(
      transaction.objectStore(PREFERENCE_STORE).get(PREFERENCE_KEY),
    )) as StoredPreferences | undefined;
    await transactionComplete(transaction);
    if (!stored) return defaultPreferences;
    return {
      selectedProgrammeVersionId: stored.selectedProgrammeVersionId,
      activeScenarioId: stored.activeScenarioId,
    };
  });

export const savePlannerPreferences = async (preferences: PlannerPreferences): Promise<void> =>
  withDatabase(async (database) => {
    const transaction = database.transaction(PREFERENCE_STORE, 'readwrite');
    transaction.objectStore(PREFERENCE_STORE).put({
      id: PREFERENCE_KEY,
      ...preferences,
    } satisfies StoredPreferences);
    await transactionComplete(transaction);
  });

export const clearPlannerData = async (): Promise<void> =>
  withDatabase(async (database) => {
    const transaction = database.transaction([SCENARIO_STORE, PREFERENCE_STORE], 'readwrite');
    transaction.objectStore(SCENARIO_STORE).clear();
    transaction.objectStore(PREFERENCE_STORE).clear();
    await transactionComplete(transaction);
  });

export const serializeScenarioEnvelope = (
  scenario: PlanningScenario,
  exportedAt = new Date().toISOString(),
): string =>
  JSON.stringify(
    {
      format: EXPORT_FORMAT,
      version: 1,
      exportedAt,
      scenario,
    } satisfies ScenarioEnvelope,
    null,
    2,
  );

export const restoreScenarioEnvelope = (serialized: string): PlanningScenario => {
  const parsed = JSON.parse(serialized) as unknown;
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('The imported planner file is not an object.');
  }
  if (!('format' in parsed) || parsed.format !== EXPORT_FORMAT) {
    throw new Error('The imported file is not a Course Data Platform planning scenario.');
  }
  if (!('version' in parsed) || parsed.version !== 1) {
    throw new Error('The imported planning scenario uses an unsupported export version.');
  }
  if (!('scenario' in parsed)) {
    throw new Error('The imported planning scenario is missing its scenario payload.');
  }
  return restoreScenario(JSON.stringify(parsed.scenario));
};
