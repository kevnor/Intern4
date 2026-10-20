import React, { useId, useState } from 'react';
import { NewUserInput, Role } from '../../../shared/types/user';
import { LookupOption, getDefaultLookupId } from '../../../shared/types/lookup';
import { createUser } from '../../../server/dao/userDAO';
import {
  Button,
  Checkbox,
  Field,
  Input,
  Modal,
  Select,
  StatusMessage,
} from '../../../shared/components';
import {
  canSubmitNewUser,
  createEmptyNewUserInput,
  prepareNewUserInput,
  validateNewUserInput,
  validateUserField,
} from '../../users/userLifecycle';

export type CreatedUser = { name: string; email: string; initialPassword?: string };

type NewUserModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (user: CreatedUser) => void;
  roles: Role[];
  rolesLoading: boolean;
  schools: LookupOption[];
  studies: LookupOption[];
  lookupsLoading: boolean;
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="space-y-4">
    <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">
      {title}
    </legend>
    {children}
  </fieldset>
);

const NewUserModal: React.FC<NewUserModalProps> = ({
  open,
  onClose,
  onCreated,
  roles,
  rolesLoading,
  schools,
  studies,
  lookupsLoading,
}) => {
  const formId = useId();
  const [userData, setUserData] = useState<NewUserInput>(() =>
    createEmptyNewUserInput(getDefaultLookupId(schools), getDefaultLookupId(studies))
  );
  const [birthDate, setBirthDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lookupOptionsReady = !lookupsLoading && schools.length > 0 && studies.length > 0;
  const canSubmit = canSubmitNewUser(userData, { isSubmitting, lookupOptionsReady });
  // Lookups can arrive after the sheet opens; fall back to their defaults until chosen.
  const schoolId = userData.schoolId || getDefaultLookupId(schools);
  const studyId = userData.studyId || getDefaultLookupId(studies);

  const update = <K extends keyof NewUserInput>(key: K, value: NewUserInput[K]) => {
    setUserData((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const updateAddress = (key: keyof NewUserInput['address'], value: string) =>
    setUserData((current) => ({ ...current, address: { ...current.address, [key]: value } }));

  const validate = (key: string, value: unknown) =>
    setErrors((current) => ({ ...current, [key]: validateUserField(key, value)[key] ?? '' }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const prepared = { ...userData, schoolId, studyId };
    const allErrors = validateNewUserInput(prepared);
    if (Object.values(allErrors).some(Boolean)) {
      setErrors(allErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const { initialPassword } = await createUser(prepareNewUserInput(prepared, schools, studies));
      onCreated({ name: prepared.name, email: prepared.email, initialPassword });
      setUserData(
        createEmptyNewUserInput(getDefaultLookupId(schools), getDefaultLookupId(studies))
      );
      setBirthDate('');
      setErrors({});
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'En feil oppstod ved oppretting av bruker'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ny bruker"
      description="Brukeren får en e-post og et midlertidig passord."
      size="lg"
      fullScreenOnMobile
      closeOnBackdrop={!isSubmitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Avbryt
          </Button>
          <Button type="submit" form={formId} loading={isSubmitting} disabled={!canSubmit}>
            Legg til bruker
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-8" noValidate>
        {submitError && <StatusMessage tone="error">{submitError}</StatusMessage>}
        {!lookupsLoading && !lookupOptionsReady && (
          <StatusMessage tone="error">Kunne ikke laste skoler og studier.</StatusMessage>
        )}

        <Section title="Person">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Navn" required error={errors.name}>
              {(field) => (
                <Input
                  {...field}
                  autoComplete="off"
                  value={userData.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="Fullt navn"
                />
              )}
            </Field>
            <Field label="E-post" required error={errors.email}>
              {(field) => (
                <Input
                  {...field}
                  type="email"
                  autoComplete="off"
                  value={userData.email}
                  onChange={(e) => update('email', e.target.value)}
                  onBlur={(e) => validate('email', e.target.value)}
                  invalid={!!errors.email}
                  placeholder="navn@eksempel.no"
                />
              )}
            </Field>
            <Field label="Telefon" error={errors.phone}>
              {(field) => (
                <Input
                  {...field}
                  type="tel"
                  value={userData.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  onBlur={(e) => validate('phone', e.target.value)}
                  invalid={!!errors.phone}
                  placeholder="400 00 000"
                />
              )}
            </Field>
            <Field label="Fødselsdato">
              {(field) => (
                <Input
                  {...field}
                  type="date"
                  value={birthDate}
                  onChange={(e) => {
                    setBirthDate(e.target.value);
                    update(
                      'birthDate',
                      e.target.value ? new Date(`${e.target.value}T12:00:00`) : undefined
                    );
                  }}
                />
              )}
            </Field>
          </div>
        </Section>

        <Section title="Bolig og rolle">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Rolle">
              {(field) => (
                <Select
                  {...field}
                  value={userData.role}
                  onChange={(e) => update('role', e.target.value)}
                  disabled={rolesLoading}
                >
                  {rolesLoading ? (
                    <option>Laster roller...</option>
                  ) : (
                    roles.map((role) => (
                      <option key={role.id} value={role.name}>
                        {role.name}
                      </option>
                    ))
                  )}
                </Select>
              )}
            </Field>
            <Field label="Romnummer" error={errors.roomNumber} hint="0 hvis ikke tildelt">
              {(field) => (
                <Input
                  {...field}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={userData.roomNumber}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                    update('roomNumber', value);
                    validate('roomNumber', value);
                  }}
                  invalid={!!errors.roomNumber}
                />
              )}
            </Field>
            <Field label="Ansiennitet (semestre)" error={errors.seniority}>
              {(field) => (
                <Input
                  {...field}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={userData.seniority}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                    update('seniority', value);
                    validate('seniority', value);
                  }}
                  invalid={!!errors.seniority}
                />
              )}
            </Field>
          </div>
          <div className="flex flex-wrap gap-x-6">
            <Checkbox
              label="Aktiv bruker"
              checked={userData.isActive}
              onChange={(e) => update('isActive', e.target.checked)}
            />
            <Checkbox
              label="På permisjon"
              checked={userData.onLeave}
              onChange={(e) => update('onLeave', e.target.checked)}
            />
          </div>
        </Section>

        <Section title="Studie">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Studieprogram">
              {(field) => (
                <Select
                  {...field}
                  value={studyId}
                  onChange={(e) => update('studyId', e.target.value)}
                  disabled={lookupsLoading}
                >
                  {lookupsLoading ? (
                    <option>Laster studier...</option>
                  ) : (
                    studies.map((study) => (
                      <option key={study.id} value={study.id}>
                        {study.name}
                      </option>
                    ))
                  )}
                </Select>
              )}
            </Field>
            <Field label="Studiested">
              {(field) => (
                <Select
                  {...field}
                  value={schoolId}
                  onChange={(e) => update('schoolId', e.target.value)}
                  disabled={lookupsLoading}
                >
                  {lookupsLoading ? (
                    <option>Laster skoler...</option>
                  ) : (
                    schools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))
                  )}
                </Select>
              )}
            </Field>
          </div>
        </Section>

        <Section title="Hjemadresse">
          <Field label="Gateadresse">
            {(field) => (
              <Input
                {...field}
                autoComplete="off"
                value={userData.address.street}
                onChange={(e) => updateAddress('street', e.target.value)}
              />
            )}
          </Field>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4">
            <Field label="Postnummer">
              {(field) => (
                <Input
                  {...field}
                  inputMode="numeric"
                  autoComplete="off"
                  value={userData.address.postalCode}
                  onChange={(e) => updateAddress('postalCode', e.target.value)}
                />
              )}
            </Field>
            <Field label="Poststed">
              {(field) => (
                <Input
                  {...field}
                  autoComplete="off"
                  value={userData.address.city}
                  onChange={(e) => updateAddress('city', e.target.value)}
                />
              )}
            </Field>
          </div>
        </Section>
      </form>
    </Modal>
  );
};

export default NewUserModal;
