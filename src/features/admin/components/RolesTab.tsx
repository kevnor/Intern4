import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card, Skeleton, StatusMessage } from '../../../shared/components';
import { getAllUsersWithRole } from '../../../server/dao/userDAO';
import { getErrorMessage } from '../../../shared/utils/errors';
import type { BasicUserWithRole } from '../../../shared/types/user';
import { residentProfilePath } from '../../residents/paths';
import { groupByRole } from '../roles';

// Who holds each position role. A role is changed on the person's profile (Rediger).
const RolesTab: React.FC = () => {
  const [users, setUsers] = useState<BasicUserWithRole[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    getAllUsersWithRole()
      .then((result) => current && setUsers(result))
      .catch((loadError) => {
        console.error(loadError);
        if (current) setError(getErrorMessage(loadError, 'Kunne ikke laste rollene.'));
      });
    return () => {
      current = false;
    };
  }, []);

  if (error) return <StatusMessage tone="error">{error}</StatusMessage>;
  if (!users) return <Skeleton className="h-48 rounded-2xl" />;

  return (
    <Card
      title="Roller"
      description="Hvem som har hver rolle. Åpne beboeren og velg Rediger for å endre rollen."
    >
      <ul className="divide-y divide-border">
        {groupByRole(users).map(({ role, holders }) => (
          <li
            key={role}
            className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-6"
          >
            <p className="text-sm font-medium sm:w-44 sm:shrink-0">{role}</p>
            {holders.length === 0 ? (
              <Badge tone="warning">Ingen</Badge>
            ) : (
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {holders.map((holder) => (
                  <li key={holder.id}>
                    <Link
                      to={residentProfilePath(holder.id)}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {holder.name}
                    </Link>
                    {holder.onLeave && <span className="text-xs text-muted"> (permisjon)</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default RolesTab;
