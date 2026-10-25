import { useCallback, useEffect, useState } from 'react';
import { getResidentDirectoryUsers } from '../../server/dao/userDAO';
import { getRooms } from '../../server/dao/roomsDAO';
import { getRoomReports } from '../../server/dao/roomReportsDAO';
import { getPendingRegiApprovals } from '../../server/dao/regiDAO';
import { getRecentResidentEvents } from '../../server/dao/offboardingDAO';
import { getErrorMessage } from '../../shared/utils/errors';
import type { ResidentFeedEvent } from '../residents/offboarding';
import { summarizeAdmin, type AdminOverview } from './overview';

const settled = <T>(result: PromiseSettledResult<T>): T | undefined => {
  if (result.status === 'fulfilled') return result.value;
  console.error(result.reason);
  return undefined;
};

// Reads every source at once. One that fails or is not allowed for this role leaves its numbers
// unknown instead of taking the page down.
export const useAdminOverview = () => {
  const [overview, setOverview] = useState<AdminOverview | null>(null);

  useEffect(() => {
    let current = true;
    Promise.allSettled([
      getResidentDirectoryUsers(true),
      getRooms(),
      getRoomReports(),
      getPendingRegiApprovals(),
    ]).then(([residents, rooms, reports, approvals]) => {
      if (!current) return;
      setOverview(
        summarizeAdmin({
          residents: settled(residents),
          rooms: settled(rooms),
          reports: settled(reports),
          pendingApprovals: settled(approvals)?.length,
        })
      );
    });
    return () => {
      current = false;
    };
  }, []);

  return overview;
};

const PAGE_SIZE = 30;

// The log for everyone, newest first. refresh() starts again from the top, loadMore() adds a page.
export const useResidentFeed = () => {
  const [events, setEvents] = useState<ResidentFeedEvent[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const page = await getRecentResidentEvents(PAGE_SIZE);
      setEvents(page.events);
      setHasMore(page.hasMore);
      setError(null);
    } catch (loadError) {
      console.error(loadError);
      setError(getErrorMessage(loadError, 'Kunne ikke laste hendelsene.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const page = await getRecentResidentEvents(PAGE_SIZE, events.length);
      setEvents((previous) => [...previous, ...page.events]);
      setHasMore(page.hasMore);
    } catch (loadError) {
      console.error(loadError);
      setError(getErrorMessage(loadError, 'Kunne ikke laste flere hendelser.'));
    } finally {
      setLoadingMore(false);
    }
  }, [events.length]);

  return { events, hasMore, loading, loadingMore, error, refresh, loadMore };
};
