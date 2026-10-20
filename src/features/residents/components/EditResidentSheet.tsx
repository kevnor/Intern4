import React, { useId, useState } from 'react';
import { updateUser } from '../../../server/dao/userDAO';
import { Role } from '../../../shared/types/user';
import { LookupOption } from '../../../shared/types/lookup';
import {
  Button,
  Checkbox,
  Field,
  Input,
  Modal,
  Select,
  StatusMessage,
} from '../../../shared/components';
import { formatDateColumnValue } from '../../../shared/utils/date';
import { normalizePhoneNumber, validatePhoneNumber } from '../../../shared/utils/phone';
import { validateUserField } from '../../users/userLifecycle';
import { canAssignRole, canAssignRoles } from '../../users/permissions';
import type { ResidentProfile } from '../hooks/useResidentProfile';

type EditResidentSheetProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  resident: ResidentProfile;
  callerRole?: string;
  isSelf: boolean;
  roles: Role[];
  schools: LookupOption[];
  studies: LookupOption[];
};

const toFormState = (resident: ResidentProfile) => ({
  name: resident.name,
  phone: resident.phone ?? '',
  birthDate: resident.birthDate ? formatDateColumnValue(resident.birthDate) : '',
  roomNumber: String(resident.roomNumber ?? 0),
  seniority: String(resident.seniority ?? 0),
  schoolId: resident.schoolId ?? '',
  studyId: resident.studyId ?? '',
  onLeave: resident.onLeave,
  role: resident.role,
});

const EditResidentSheet: React.FC<EditResidentSheetProps> = ({
  open,
  onClose,
  onSaved,
  resident,
  callerRole,
  isSelf,
  roles,
  schools,
  studies,
}) => {
  const formId = useId();
  const [form, setForm] = useState(() => toFormState(resident));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Nobody changes their own role; the database refuses it too.
  const showRole = canAssignRoles(callerRole) && !isSelf;
  const assignableRoles = roles.filter(
    (role) => role.name === resident.role || canAssignRole(callerRole, role.name)
  );
  // An Admin's role can only be changed by another Admin.
  const roleLocked = !canAssignRole(callerRole, resident.role);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaveError(null);

    const roomNumber = form.roomNumber === '' ? 0 : parseInt(form.roomNumber);
    const seniority = form.seniority === '' ? 0 : parseInt(form.seniority);
    const phone = normalizePhoneNumber(form.phone);
    const nextErrors: Record<string, string> = {
      ...(form.name.trim() ? {} : { name: 'Navn kan ikke være tomt' }),
      ...validateUserField('roomNumber', roomNumber),
      ...validateUserField('seniority', seniority),
      ...(validatePhoneNumber(phone) ? { phone: validatePhoneNumber(phone)! } : {}),
    };
    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      return;
    }

    const roleChanged = showRole && form.role !== resident.role;
    setSaving(true);
    try {
      await updateUser(resident.id, {
        name: form.name.trim(),
        phone,
        // Noon keeps the chosen calendar day regardless of time zone.
        birthDate: form.birthDate ? new Date(`${form.birthDate}T12:00:00`) : undefined,
        roomNumber,
        seniority,
        schoolId: form.schoolId || undefined,
        studyId: form.studyId || undefined,
        onLeave: form.onLeave,
        roleId: roleChanged ? roles.find((role) => role.name === form.role)?.id : undefined,
      });
      onSaved();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Kunne ikke lagre endringene.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Rediger ${resident.name}`}
      size="lg"
      fullScreenOnMobile
      closeOnBackdrop={!saving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Avbryt
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            Lagre endringer
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-5" noValidate>
        {saveError && <StatusMessage tone="error">{saveError}</StatusMessage>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Navn" required error={errors.name}>
            {(field) => (
              <Input
                {...field}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                invalid={!!errors.name}
              />
            )}
          </Field>
          <Field label="E-post" hint="Endres av Data.">
            {(field) => <Input {...field} value={resident.email} readOnly disabled />}
          </Field>
          <Field label="Telefon" error={errors.phone}>
            {(field) => (
              <Input
                {...field}
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                invalid={!!errors.phone}
              />
            )}
          </Field>
          <Field label="Fødselsdato">
            {(field) => (
              <Input
                {...field}
                type="date"
                value={form.birthDate}
                onChange={(e) => set('birthDate', e.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Romnummer" error={errors.roomNumber} hint="0 hvis ikke tildelt">
            {(field) => (
              <Input
                {...field}
                type="number"
                inputMode="numeric"
                min="0"
                value={form.roomNumber}
                onChange={(e) => set('roomNumber', e.target.value)}
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
                value={form.seniority}
                onChange={(e) => set('seniority', e.target.value)}
                invalid={!!errors.seniority}
              />
            )}
          </Field>
          {showRole && (
            <Field
              label="Rolle"
              hint={roleLocked ? 'Bare Admin kan endre denne rollen.' : undefined}
            >
              {(field) => (
                <Select
                  {...field}
                  value={form.role}
                  onChange={(e) => set('role', e.target.value)}
                  disabled={roleLocked}
                >
                  {assignableRoles.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Studieprogram">
            {(field) => (
              <Select
                {...field}
                value={form.studyId}
                onChange={(e) => set('studyId', e.target.value)}
              >
                {studies.map((study) => (
                  <option key={study.id} value={study.id}>
                    {study.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Studiested">
            {(field) => (
              <Select
                {...field}
                value={form.schoolId}
                onChange={(e) => set('schoolId', e.target.value)}
              >
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Checkbox
          label="På permisjon"
          checked={form.onLeave}
          onChange={(e) => set('onLeave', e.target.checked)}
        />
      </form>
    </Modal>
  );
};

export default EditResidentSheet;
