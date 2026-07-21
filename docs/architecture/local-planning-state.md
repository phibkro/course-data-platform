# Local planning state

Planning scenarios are private, portable projections over public programme data. They are not part of the catalogue API and do not require an account.

## Ownership

| State                             | Owner                              |
| --------------------------------- | ---------------------------------- |
| Programme and course data         | Public API / TanStack Query        |
| Selected programme version        | IndexedDB planner preferences      |
| Active scenario                   | IndexedDB planner preferences      |
| Scenario contents                 | IndexedDB planning-scenarios store |
| Current view and catalogue search | URL                                |
| Temporary control state           | React component                    |

## Scenario compatibility

Each scenario stores:

- `schemaVersion` for its serialized shape;
- `programmeVersionId` for the official or provisional curriculum it references;
- `dataRevision` for the public dataset against which it was generated;
- stable course-version and requirement-group identifiers.

Runtime validation occurs when a scenario is restored or imported. Older unversioned prototype scenarios migrate to schema version 1. A future catalogue revision does not silently rewrite a scenario; the planner will compare revisions and explain changes.

## Portable envelope

Exports wrap the scenario in a format and export version. Import rejects unrelated JSON, unsupported versions, and scenarios belonging to another selected programme version. Imported scenarios receive a new local identity to avoid overwriting an existing plan.

## Privacy

The IndexedDB database contains only the programme selection, scenarios, and planner preferences. No data leaves the device. A single Workbench action removes all local planner state.
