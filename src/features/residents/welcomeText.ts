// The message a manager passes on to a new resident (in mail or chat). With Microsoft sign-in there
// is no password to hand over; while email and password is still on, it is added.
export const buildWelcomeText = ({
  name,
  email,
  loginUrl,
  initialPassword,
}: {
  name: string;
  email: string;
  loginUrl: string;
  initialPassword?: string;
}): string => {
  const firstName = name.trim().split(/\s+/)[0] || name;
  const lines = [
    `Hei ${firstName}!`,
    '',
    'Du er nå lagt til på Singsakers interne side.',
    '',
    `Logg inn her: ${loginUrl}`,
    `Trykk «Logg inn med Microsoft» og bruk Microsoft-kontoen ${email}.`,
  ];

  if (initialPassword) {
    lines.push(
      '',
      `Du kan også logge inn med e-post og dette midlertidige passordet: ${initialPassword}`,
      'Bytt passordet etter første innlogging.'
    );
  }

  return lines.join('\n');
};
