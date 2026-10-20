import { useAuth } from '../providers/AuthContext';
import { appNavigation } from './navigation';
import type { FeatureNavItem } from '../../shared/types/feature';

// Navigation items the current user may see; groups without visible children are dropped.
export const useVisibleNavigation = (): FeatureNavItem[] => {
  const { user } = useAuth();

  const canAccess = (item: Pick<FeatureNavItem, 'canAccess'>) =>
    item.canAccess ? item.canAccess({ user }) : true;

  return appNavigation.reduce<FeatureNavItem[]>((items, item) => {
    if (item.children) {
      const visibleChildren = item.children.filter((child) => canAccess(child));
      if (!canAccess(item) || visibleChildren.length === 0) {
        return items;
      }

      items.push({ ...item, children: visibleChildren });
      return items;
    }

    if (canAccess(item)) {
      items.push(item);
    }

    return items;
  }, []);
};
