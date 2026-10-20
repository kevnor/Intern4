import React, { useEffect, useMemo, useState } from 'react';
import { Camera } from 'lucide-react';
import { useAuth } from '../../../app/providers/AuthContext';
import { ThemeSelector } from '../../../app/layout/ThemeSelector';
import { supabase } from '../../../server/supabaseClient';
import { getSchools, getStudies, getUser, updateUser } from '../../../server/dao/userDAO';
import { resetPassword } from '../../../server/dao/authentication';
import {
  createSignedImageUrl,
  deleteImages,
  deleteImagesBestEffort,
  uploadImages,
} from '../../../server/storage';
import { PageLayout } from '../../../shared/layouts';
import { getDefaultLookupId, LookupOption } from '../../../shared/types/lookup';
import { normalizePhoneNumber, validatePhoneNumber } from '../../../shared/utils/phone';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PasswordInput,
  SectionTabs,
  Select,
  Skeleton,
  Spinner,
  StatusMessage,
} from '../../../shared/components';

type ProfileTab = 'profil' | 'passord' | 'utseende';

const PROFILE_TABS: { key: ProfileTab; label: string }[] = [
  { key: 'profil', label: 'Profil' },
  { key: 'passord', label: 'Passord' },
  { key: 'utseende', label: 'Utseende' },
];

type GeneralInfoFormState = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
  street: string;
  postalCode: string;
  city: string;
  schoolId: string;
  studyId: string;
};

const emptyGeneralInfoForm = (): GeneralInfoFormState => ({
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  phone: '',
  birthDate: '',
  street: '',
  postalCode: '',
  city: '',
  schoolId: '',
  studyId: '',
});

const splitFullName = (
  fullName?: string
): Pick<GeneralInfoFormState, 'firstName' | 'middleName' | 'lastName'> => {
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];

  if (parts.length === 0) {
    return { firstName: '', middleName: '', lastName: '' };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], middleName: '', lastName: '' };
  }

  if (parts.length === 2) {
    return { firstName: parts[0], middleName: '', lastName: parts[1] };
  }

  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
};

const mergeFullName = ({
  firstName,
  middleName,
  lastName,
}: Pick<GeneralInfoFormState, 'firstName' | 'middleName' | 'lastName'>): string =>
  [firstName, middleName, lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');

const formatDateForInput = (value: unknown): string => {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value.slice(0, 10);
  return '';
};

const ProfilePage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [profileLoading, setProfileLoading] = useState(true);
  const [form, setForm] = useState<GeneralInfoFormState>(emptyGeneralInfoForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [savingGeneralInfo, setSavingGeneralInfo] = useState(false);
  const [schools, setSchools] = useState<LookupOption[]>([]);
  const [studies, setStudies] = useState<LookupOption[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('profil');
  const [profilePicturePath, setProfilePicturePath] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [savingProfilePicture, setSavingProfilePicture] = useState(false);
  const [profilePictureError, setProfilePictureError] = useState<string | null>(null);
  const [profilePictureSuccess, setProfilePictureSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) {
        setProfileLoading(false);
        return;
      }

      try {
        setProfileLoading(true);
        setFormError(null);
        const [profile, schoolOptions, studyOptions] = await Promise.all([
          getUser(user.id),
          getSchools(),
          getStudies(),
        ]);

        if (!profile) {
          setFormError('Kunne ikke finne profilen din.');
          setProfileLoading(false);
          return;
        }

        setSchools(schoolOptions);
        setStudies(studyOptions);

        const nameParts = splitFullName(profile.name);

        setForm({
          firstName: nameParts.firstName,
          middleName: nameParts.middleName,
          lastName: nameParts.lastName,
          email: profile.email ?? user.email ?? '',
          phone: profile.phone ?? '',
          birthDate: formatDateForInput(profile.birthDate),
          street: profile.address?.street ?? '',
          postalCode: profile.address?.postalCode ?? '',
          city: profile.address?.city ?? '',
          schoolId: profile.schoolId ?? getDefaultLookupId(schoolOptions),
          studyId: profile.studyId ?? getDefaultLookupId(studyOptions),
        });
        setProfilePicturePath(profile.profilePicture ?? '');
        if (profile.profilePicture) {
          createSignedImageUrl(profile.profilePicture)
            .then(setProfilePictureUrl)
            .catch((imageError) => {
              console.error(imageError);
              setProfilePictureUrl(null);
            });
        } else {
          setProfilePictureUrl(null);
        }
      } catch (error) {
        console.error(error);
        setFormError('Kunne ikke laste profilinformasjon.');
      } finally {
        setProfileLoading(false);
      }
    };

    if (authLoading) return;
    void loadProfile();
    // Depend on the id, not the user object: it is recreated on every auth event (such as a
    // token refresh), and reloading would overwrite unsaved edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  const fullName = useMemo(
    () =>
      mergeFullName({
        firstName: form.firstName,
        middleName: form.middleName,
        lastName: form.lastName,
      }),
    [form.firstName, form.lastName, form.middleName]
  );

  const setField = (field: keyof GeneralInfoFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError(null);
    setFormSuccess(null);
  };

  const handleGeneralInfoSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user?.id) return;

    if (!fullName) {
      setFormError('Navn kan ikke være tomt.');
      return;
    }

    const normalizedPhone = normalizePhoneNumber(form.phone);
    const phoneError = validatePhoneNumber(normalizedPhone);
    if (phoneError) {
      setFormError(phoneError);
      return;
    }

    try {
      setSavingGeneralInfo(true);
      setFormError(null);
      setFormSuccess(null);

      await updateUser(user.id, {
        name: fullName,
        phone: normalizedPhone,
        birthDate: form.birthDate ? new Date(form.birthDate) : undefined,
        address: {
          street: form.street.trim(),
          postalCode: form.postalCode.trim(),
          city: form.city.trim(),
        },
        schoolId: form.schoolId || undefined,
        studyId: form.studyId || undefined,
      });

      await supabase.auth.refreshSession();
      setFormSuccess('Profilen din ble oppdatert.');
    } catch (error) {
      console.error(error);
      setFormError('Kunne ikke lagre profilinformasjon.');
    } finally {
      setSavingGeneralInfo(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 6) {
      setPasswordError('Passordet må være minst 6 tegn.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passordene stemmer ikke overens.');
      return;
    }

    try {
      setSavingPassword(true);
      const result = await resetPassword(newPassword);

      if (!result.success) {
        setPasswordError(result.error);
        return;
      }

      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Passordet ditt ble oppdatert.');
    } catch (error) {
      console.error(error);
      setPasswordError('Kunne ikke oppdatere passordet.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleProfilePictureChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !user?.id) return;

    let uploadedPaths: string[] = [];
    let profilePictureUpdated = false;

    try {
      setSavingProfilePicture(true);
      setProfilePictureError(null);
      setProfilePictureSuccess(null);

      uploadedPaths = await uploadImages(user.id, 'profile', [file]);
      const nextPath = uploadedPaths[0];

      await updateUser(user.id, {
        profilePicture: nextPath,
      });
      profilePictureUpdated = true;

      if (
        profilePicturePath &&
        profilePicturePath !== nextPath &&
        profilePicturePath.startsWith(`${user.id}/`)
      ) {
        await deleteImagesBestEffort([profilePicturePath]);
      }

      setProfilePicturePath(nextPath);
      setProfilePictureUrl(await createSignedImageUrl(nextPath));
      await supabase.auth.refreshSession();
      setProfilePictureSuccess('Profilbildet ble oppdatert.');
    } catch (error) {
      let handledError = error;
      if (!profilePictureUpdated) {
        try {
          await deleteImages(uploadedPaths);
        } catch (cleanupError) {
          const message =
            error instanceof Error ? error.message : 'Kunne ikke laste opp profilbilde.';
          const cleanupMessage =
            cleanupError instanceof Error ? cleanupError.message : 'opprydding feilet';
          handledError = new Error(`${message} ${cleanupMessage}`);
        }
      }
      console.error(handledError);
      setProfilePictureError(
        handledError instanceof Error ? handledError.message : 'Kunne ikke laste opp profilbilde.'
      );
    } finally {
      setSavingProfilePicture(false);
    }
  };

  if (authLoading) {
    return null;
  }

  const initials =
    fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';

  return (
    <PageLayout title="Profil" description="Kontaktinformasjon, passord og utseende.">
      <Card>
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div className="relative shrink-0">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-primary-subtle text-2xl font-semibold text-primary-subtle-fg ring-4 ring-surface">
              {profilePictureUrl ? (
                <img
                  src={profilePictureUrl}
                  alt="Profilbilde"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span aria-hidden="true">{initials}</span>
              )}
            </div>
            <label
              htmlFor="profile-picture"
              title="Bytt profilbilde"
              className="absolute -bottom-1 -right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-fg shadow-md ring-4 ring-surface hover:bg-primary-hover"
            >
              {savingProfilePicture ? (
                <Spinner label="Laster opp..." className="h-4 w-4" />
              ) : (
                <Camera aria-hidden="true" className="h-4 w-4" />
              )}
            </label>
            <input
              id="profile-picture"
              type="file"
              accept="image/*"
              aria-label="Last opp bilde"
              className="sr-only"
              onChange={handleProfilePictureChange}
              disabled={savingProfilePicture}
            />
          </div>
          <div className="min-w-0 space-y-1">
            {profileLoading ? (
              <>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-40" />
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold">{fullName || user?.name || 'Profil'}</h2>
                <p className="truncate text-sm text-muted">{form.email || user?.email}</p>
                {user?.role && <Badge tone="primary">{user.role}</Badge>}
              </>
            )}
          </div>
        </div>
        {(profilePictureError || profilePictureSuccess) && (
          <div className="mt-4">
            {profilePictureError && (
              <StatusMessage tone="error" onDismiss={() => setProfilePictureError(null)}>
                {profilePictureError}
              </StatusMessage>
            )}
            {profilePictureSuccess && (
              <StatusMessage tone="success" onDismiss={() => setProfilePictureSuccess(null)}>
                {profilePictureSuccess}
              </StatusMessage>
            )}
          </div>
        )}
      </Card>

      <SectionTabs
        label="Profilinnstillinger"
        tabs={PROFILE_TABS}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as ProfileTab)}
      />

      {activeTab === 'profil' && (
        <Card title="Generell info" description="Navn, kontaktinformasjon og studieopplysninger.">
          {profileLoading ? (
            <div aria-busy="true" className="space-y-3">
              <span className="sr-only">Laster profilinformasjon...</span>
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleGeneralInfoSubmit} noValidate>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Fornavn">
                  {(field) => (
                    <Input
                      {...field}
                      autoComplete="given-name"
                      value={form.firstName}
                      onChange={(event) => setField('firstName', event.target.value)}
                    />
                  )}
                </Field>
                <Field label="Mellomnavn">
                  {(field) => (
                    <Input
                      {...field}
                      autoComplete="additional-name"
                      value={form.middleName}
                      onChange={(event) => setField('middleName', event.target.value)}
                    />
                  )}
                </Field>
                <Field label="Etternavn">
                  {(field) => (
                    <Input
                      {...field}
                      autoComplete="family-name"
                      value={form.lastName}
                      onChange={(event) => setField('lastName', event.target.value)}
                    />
                  )}
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="E-post" hint="Kan ikke endres her ennå.">
                  {(field) => <Input {...field} value={form.email} readOnly disabled />}
                </Field>
                <Field label="Telefon">
                  {(field) => (
                    <Input
                      {...field}
                      type="tel"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={(event) => setField('phone', event.target.value)}
                    />
                  )}
                </Field>
                <Field label="Fødselsdato">
                  {(field) => (
                    <Input
                      {...field}
                      type="date"
                      value={form.birthDate}
                      onChange={(event) => setField('birthDate', event.target.value)}
                    />
                  )}
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.5fr)]">
                <Field label="Adresse">
                  {(field) => (
                    <Input
                      {...field}
                      autoComplete="street-address"
                      value={form.street}
                      onChange={(event) => setField('street', event.target.value)}
                    />
                  )}
                </Field>
                <Field label="Postnummer">
                  {(field) => (
                    <Input
                      {...field}
                      inputMode="numeric"
                      autoComplete="postal-code"
                      value={form.postalCode}
                      onChange={(event) => setField('postalCode', event.target.value)}
                    />
                  )}
                </Field>
                <Field label="By">
                  {(field) => (
                    <Input
                      {...field}
                      autoComplete="address-level2"
                      value={form.city}
                      onChange={(event) => setField('city', event.target.value)}
                    />
                  )}
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Skole / studiested">
                  {(field) => (
                    <Select
                      {...field}
                      value={form.schoolId}
                      onChange={(event) => setField('schoolId', event.target.value)}
                      disabled={savingGeneralInfo}
                    >
                      {schools.map((school) => (
                        <option key={school.id} value={school.id}>
                          {school.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Studie">
                  {(field) => (
                    <Select
                      {...field}
                      value={form.studyId}
                      onChange={(event) => setField('studyId', event.target.value)}
                      disabled={savingGeneralInfo}
                    >
                      {studies.map((study) => (
                        <option key={study.id} value={study.id}>
                          {study.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>

              {formError && <StatusMessage tone="error">{formError}</StatusMessage>}
              {formSuccess && <StatusMessage tone="success">{formSuccess}</StatusMessage>}

              <div className="flex justify-end">
                <Button type="submit" loading={savingGeneralInfo} className="w-full sm:w-auto">
                  Lagre endringer
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {activeTab === 'passord' && (
        <Card title="Endre passord" description="Bytt passordet du bruker for å logge inn.">
          <form className="max-w-md space-y-4" onSubmit={handlePasswordSubmit} noValidate>
            <Field label="Nytt passord" required hint="Minst 6 tegn.">
              {(field) => (
                <PasswordInput
                  {...field}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setPasswordError(null);
                    setPasswordSuccess(null);
                  }}
                />
              )}
            </Field>
            <Field label="Gjenta passord" required>
              {(field) => (
                <PasswordInput
                  {...field}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setPasswordError(null);
                    setPasswordSuccess(null);
                  }}
                />
              )}
            </Field>

            {passwordError && <StatusMessage tone="error">{passwordError}</StatusMessage>}
            {passwordSuccess && <StatusMessage tone="success">{passwordSuccess}</StatusMessage>}

            <Button
              type="submit"
              loading={savingPassword}
              disabled={!newPassword || !confirmPassword}
              className="w-full sm:w-auto"
            >
              Oppdater passord
            </Button>
          </form>
        </Card>
      )}

      {activeTab === 'utseende' && (
        <Card
          title="Utseende"
          description="Velg lyst eller mørkt tema, eller følg innstillingen på enheten din. Valget lagres på denne enheten."
        >
          <ThemeSelector className="max-w-md" />
        </Card>
      )}
    </PageLayout>
  );
};

export default ProfilePage;
