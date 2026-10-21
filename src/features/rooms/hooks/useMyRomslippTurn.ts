import { useEffect, useState } from 'react';
import { getRomslippTurn } from '../../../server/dao/romslippDAO';

// True while a romslipp is running and it is this resident's turn. Used for the nudge on Hjem;
// if it can't be read there simply is no nudge.
export const useMyRomslippTurn = (userId: string | undefined): boolean => {
  const [myTurn, setMyTurn] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getRomslippTurn()
      .then((turn) => {
        if (!cancelled) setMyTurn(turn?.userId === userId);
      })
      .catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return myTurn;
};
