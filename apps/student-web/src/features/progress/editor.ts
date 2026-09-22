import { Schema as S } from 'effect';
import { Button, Checkbox, Input } from '@foldkit/ui';
import type { Update } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import { defineView } from 'foldkit/submodel';
import { modifyFields } from 'foldkit/struct';

import {
  buttonPrimary,
  buttonSecondary,
  compactButtonBase,
  controlGroupClass,
  fieldLabelClass,
} from '../../app-styles';
import type { Locale } from '../../i18n';
import {
  CourseDraftFieldsSchema,
  CourseResultSchema,
  courseAttemptKey,
  courseResultToDraft,
  validateCourseDraft,
  type CourseDraftFields,
  type CourseResult,
} from './domain';

const editableDraftFields = [
  'institution',
  'code',
  'name',
  'year',
  'term',
  'credits',
  'grade',
] as const;

const allDraftFields = [...editableDraftFields, 'included'] as const;

const DraftFieldSchema = S.Literals(editableDraftFields);
type DraftField = typeof DraftFieldSchema.Type;

const FieldErrorsSchema = S.Struct({
  institution: S.optional(S.String),
  code: S.optional(S.String),
  name: S.optional(S.String),
  year: S.optional(S.String),
  term: S.optional(S.String),
  credits: S.optional(S.String),
  grade: S.optional(S.String),
  included: S.optional(S.String),
});
type FieldErrors = typeof FieldErrorsSchema.Type;

const ConfirmationSchema = S.Literals(['none', 'discard', 'remove']);
type Confirmation = typeof ConfirmationSchema.Type;

/**
 * The editor is a local draft only. The parent owns the results collection and
 * decides whether an optimistic save still matches its current revision.
 */
export const Model = S.Struct({
  originalAttemptKey: S.NullOr(S.String),
  fields: CourseDraftFieldsSchema,
  baseRevision: S.Number,
  dirty: S.Boolean,
  errors: FieldErrorsSchema,
  confirmation: ConfirmationSchema,
});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  ChangedField: { field: DraftFieldSchema, value: S.String },
  ToggledIncluded: { included: S.Boolean },
  RequestedSave: {},
  RequestedClose: {},
  RequestedRemove: {},
  CancelledConfirmation: {},
  ConfirmedDiscard: {},
  ConfirmedRemove: {},
});
export type Message = typeof Message.Type;

/**
 * Save and Remove deliberately carry the revision read when the editor opened.
 * That lets the parent reject a stale attempt without this draft ever writing
 * to browser storage on its own.
 */
export const OutMessage = defineMessageUnion({
  Save: {
    result: CourseResultSchema,
    originalAttemptKey: S.NullOr(S.String),
    baseRevision: S.Number,
  },
  Remove: { attemptKey: S.String, baseRevision: S.Number },
  Close: {},
});
export type OutMessage = typeof OutMessage.Type;

const emptyFields: CourseDraftFields = {
  institution: 'NTNU',
  code: '',
  name: '',
  year: '',
  term: '',
  credits: '',
  grade: '',
  included: true,
};

const noErrors: FieldErrors = {};

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>;

/** Opens one editor for either a new local result or a concrete prior attempt. */
export const init = (result: CourseResult | null, baseRevision: number): Model => ({
  originalAttemptKey: result === null ? null : courseAttemptKey(result),
  fields: result === null ? emptyFields : courseResultToDraft(result),
  baseRevision,
  dirty: false,
  errors: noErrors,
  confirmation: 'none',
});

const changedFields = (
  fields: CourseDraftFields,
  field: DraftField,
  value: string,
): CourseDraftFields => ({
  ...fields,
  [field]: value,
});

const toggledIncluded = (fields: CourseDraftFields, included: boolean): CourseDraftFields => ({
  ...fields,
  included,
});

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    ChangedField: ({ field, value }) => {
      if (model.confirmation !== 'none' || model.fields[field] === value) return { model };
      return {
        model: modifyFields(model, {
          fields: (fields) => changedFields(fields, field, value),
          dirty: () => true,
          errors: () => noErrors,
        }),
      };
    },
    ToggledIncluded: ({ included }) => {
      if (model.confirmation !== 'none' || model.fields.included === included) return { model };
      return {
        model: modifyFields(model, {
          fields: (fields) => toggledIncluded(fields, included),
          dirty: () => true,
          errors: () => noErrors,
        }),
      };
    },
    RequestedSave: () => {
      if (model.confirmation !== 'none') return { model };
      const validation = validateCourseDraft(model.fields);
      return validation.ok
        ? {
            model,
            outMessage: OutMessage.Save({
              result: validation.result,
              originalAttemptKey: model.originalAttemptKey,
              baseRevision: model.baseRevision,
            }),
          }
        : {
            model: modifyFields(model, {
              errors: () => validation.errors,
            }),
          };
    },
    RequestedClose: () => {
      if (model.confirmation !== 'none') return { model };
      return model.dirty
        ? {
            model: modifyFields(model, {
              confirmation: () => 'discard',
            }),
          }
        : { model, outMessage: OutMessage.Close() };
    },
    RequestedRemove: () => {
      if (model.confirmation !== 'none' || model.originalAttemptKey === null) return { model };
      return {
        model: modifyFields(model, {
          confirmation: () => 'remove',
        }),
      };
    },
    CancelledConfirmation: () =>
      model.confirmation === 'none'
        ? { model }
        : {
            model: modifyFields(model, {
              confirmation: () => 'none',
            }),
          },
    ConfirmedDiscard: () =>
      model.confirmation !== 'discard'
        ? { model }
        : {
            model: modifyFields(model, {
              confirmation: () => 'none',
            }),
            outMessage: OutMessage.Close(),
          },
    ConfirmedRemove: () => {
      const attemptKey = model.originalAttemptKey;
      if (model.confirmation !== 'remove' || attemptKey === null) return { model };
      return {
        model: modifyFields(model, {
          confirmation: () => 'none',
        }),
        outMessage: OutMessage.Remove({ attemptKey, baseRevision: model.baseRevision }),
      };
    },
  });

export interface Labels {
  readonly addHeading: string;
  readonly editHeading: string;
  readonly description: string;
  readonly institution: string;
  readonly code: string;
  readonly name: string;
  readonly year: string;
  readonly term: string;
  readonly credits: string;
  readonly grade: string;
  readonly included: string;
  readonly addCourse: string;
  readonly saveChanges: string;
  readonly cancel: string;
  readonly remove: string;
  readonly unsavedChanges: string;
  readonly validationSummary: string;
  readonly discardConfirmation: string;
  readonly discardChanges: string;
  readonly removeConfirmation: string;
  readonly confirmRemove: string;
  readonly keepEditing: string;
}

export interface ViewInputs {
  readonly locale: Locale;
  readonly labels: Labels;
}

const editorPanelClass =
  '@container grid gap-5 rounded-m3-extra-large border border-outline-variant bg-surface-container-low p-[clamp(1rem,3vw,1.5rem)] shadow-m3-1';
const inputClass =
  'w-full min-h-12 px-4 border border-outline rounded-m3-medium outline-0 bg-surface-container-low text-on-surface text-base transition-[border-color,box-shadow] duration-150 ease-in-out focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--md-sys-color-primary-container)] disabled:cursor-not-allowed disabled:opacity-70 data-[invalid]:border-error';
const inputErrorClass = 'm-0 mt-1 text-sm leading-[1.45] text-error';
const checkboxLabelClass =
  'inline-flex min-h-11 cursor-pointer items-center gap-[0.55rem] rounded-[1.5rem] border border-outline px-3 text-sm font-bold text-on-surface-variant focus-within:outline-3 focus-within:outline-tertiary focus-within:outline-offset-[3px] has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary-container has-[[data-checked]]:text-on-primary-container data-[disabled]:cursor-not-allowed data-[disabled]:opacity-70';
const checkboxBoxClass =
  'grid size-[1.15rem] place-items-center rounded-[0.3rem] border-2 border-current text-xs leading-none';
const removeButtonClass = `${compactButtonBase} min-h-11 rounded-[1.5rem] border border-error bg-error-container px-3 text-sm font-bold text-on-error-container`;

const hasErrors = (errors: FieldErrors): boolean =>
  allDraftFields.some((field) => errors[field] !== undefined);

const fieldId = (field: DraftField): string => `progress-course-editor-${field}`;

const textField = (
  field: DraftField,
  label: string,
  model: Model,
  isDisabled: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const error = model.errors[field];
  return Input.view<Message>(
    {
      id: fieldId(field),
      name: field,
      value: model.fields[field],
      isDisabled,
      isInvalid: error !== undefined,
      hasDescription: error !== undefined,
      onInput: (value) => Message.ChangedField({ field, value }),
      toView: (attributes) =>
        h.div(
          [h.Class(`grid gap-1 ${field === 'name' ? '@min-[34rem]:col-span-2' : ''}`)],
          [
            h.label([...attributes.label, h.Class(fieldLabelClass)], [label]),
            h.input([...attributes.input, h.Autocomplete('off'), h.Class(inputClass)]),
            error === undefined
              ? h.empty
              : h.p([...attributes.description, h.Class(inputErrorClass)], [error]),
          ],
        ),
    },
    h,
  );
};

const includedControl = (
  model: Model,
  label: string,
  isDisabled: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const error = model.errors.included;
  return Checkbox.view<Message>(
    {
      id: 'progress-course-editor-included',
      isChecked: model.fields.included,
      isDisabled,
      hasDescription: error !== undefined,
      onToggle: (included) => Message.ToggledIncluded({ included }),
      toView: (attributes) =>
        h.div(
          [h.Class('grid gap-1')],
          [
            h.label(
              [...attributes.label, h.Class(checkboxLabelClass)],
              [
                h.span(
                  [...attributes.checkbox, h.Class(checkboxBoxClass)],
                  [model.fields.included ? '✓' : ''],
                ),
                h.span([], [label]),
              ],
            ),
            error === undefined
              ? h.empty
              : h.p([...attributes.description, h.Class(inputErrorClass)], [error]),
          ],
        ),
    },
    h,
  );
};

const confirmationView = (
  confirmation: Confirmation,
  labels: Labels,
  h: HtmlBuilder<Message>,
): Html => {
  if (confirmation === 'none') return h.empty;

  const removing = confirmation === 'remove';
  const prompt = removing ? labels.removeConfirmation : labels.discardConfirmation;
  const confirmLabel = removing ? labels.confirmRemove : labels.discardChanges;
  const confirmMessage = removing ? Message.ConfirmedRemove() : Message.ConfirmedDiscard();

  return h.div(
    [
      h.Class('grid gap-3 rounded-m3-large border border-outline-variant bg-surface-container p-4'),
      h.Role('group'),
      h.AriaLabel(prompt),
    ],
    [
      h.p([h.Class('m-0 font-bold leading-[1.45]'), h.Role('alert')], [prompt]),
      h.div(
        [h.Class(controlGroupClass)],
        [
          Button.view<Message>(
            {
              type: 'button',
              onClick: confirmMessage,
              toView: (attributes) =>
                h.button(
                  [
                    ...attributes.button,
                    h.Class(
                      removing
                        ? removeButtonClass
                        : `${compactButtonBase} ${buttonPrimary} min-h-11`,
                    ),
                  ],
                  [confirmLabel],
                ),
            },
            h,
          ),
          Button.view<Message>(
            {
              type: 'button',
              onClick: Message.CancelledConfirmation(),
              toView: (attributes) =>
                h.button(
                  [
                    ...attributes.button,
                    h.Class(`${compactButtonBase} ${buttonSecondary} min-h-11`),
                  ],
                  [labels.keepEditing],
                ),
            },
            h,
          ),
        ],
      ),
    ],
  );
};

export const view = defineView<Model, Message, ViewInputs>((model, { locale, labels }, h) => {
  const isEditing = model.originalAttemptKey !== null;
  const isConfirming = model.confirmation !== 'none';
  const heading = isEditing ? labels.editHeading : labels.addHeading;
  const saveLabel = isEditing ? labels.saveChanges : labels.addCourse;

  return h.section(
    [h.Class(editorPanelClass), h.Lang(locale), h.AriaLabel(heading)],
    [
      h.header(
        [],
        [
          h.h2([h.Class('m-0 text-lg font-extrabold')], [heading]),
          h.p(
            [h.Class('mb-0 mt-1 text-sm leading-[1.45] text-on-surface-variant')],
            [labels.description],
          ),
          model.dirty
            ? h.p(
                [h.Class('mb-0 mt-2 text-sm font-bold text-primary'), h.Role('status')],
                [labels.unsavedChanges],
              )
            : h.empty,
        ],
      ),
      hasErrors(model.errors)
        ? h.p(
            [
              h.Class(
                'm-0 rounded-m3-medium border border-error bg-error-container px-4 py-3 text-sm font-bold text-on-error-container',
              ),
              h.Role('alert'),
            ],
            [labels.validationSummary],
          )
        : h.empty,
      h.form(
        [h.Class('grid gap-4'), h.Novalidate(true), h.OnSubmit(Message.RequestedSave())],
        [
          h.div(
            [h.Class('grid gap-3 @min-[34rem]:grid-cols-2')],
            [
              textField('institution', labels.institution, model, isConfirming, h),
              textField('code', labels.code, model, isConfirming, h),
              textField('name', labels.name, model, isConfirming, h),
              textField('year', labels.year, model, isConfirming, h),
              textField('term', labels.term, model, isConfirming, h),
              textField('credits', labels.credits, model, isConfirming, h),
              textField('grade', labels.grade, model, isConfirming, h),
              includedControl(model, labels.included, isConfirming, h),
            ],
          ),
          isConfirming
            ? confirmationView(model.confirmation, labels, h)
            : h.div(
                [h.Class(controlGroupClass)],
                [
                  Button.view<Message>(
                    {
                      type: 'submit',
                      toView: (attributes) =>
                        h.button(
                          [
                            ...attributes.button,
                            h.Class(`${compactButtonBase} ${buttonPrimary} min-h-12`),
                          ],
                          [saveLabel],
                        ),
                    },
                    h,
                  ),
                  Button.view<Message>(
                    {
                      type: 'button',
                      onClick: Message.RequestedClose(),
                      toView: (attributes) =>
                        h.button(
                          [
                            ...attributes.button,
                            h.Class(`${compactButtonBase} ${buttonSecondary} min-h-12`),
                          ],
                          [labels.cancel],
                        ),
                    },
                    h,
                  ),
                  isEditing
                    ? Button.view<Message>(
                        {
                          type: 'button',
                          onClick: Message.RequestedRemove(),
                          toView: (attributes) =>
                            h.button(
                              [...attributes.button, h.Class(removeButtonClass)],
                              [labels.remove],
                            ),
                        },
                        h,
                      )
                    : h.empty,
                ],
              ),
        ],
      ),
    ],
  );
});
