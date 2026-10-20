import { supabase } from '../supabaseClient';
import { Category } from '../../shared/types/regi/tasks';

type CategoryRow = {
  id: number | string;
  name?: string | null;
  description?: string | null;
  color?: string | null;
  is_active?: boolean | null;
  created_at?: Date | string | null;
};

type CategoryUpdatePayload = {
  name?: string;
  description?: string;
  color?: string;
  is_active?: boolean;
};

function toAppCategory(row: CategoryRow): Category {
  return {
    id: String(row.id),
    name: row.name ?? '',
    description: row.description ?? '',
    color: row.color ?? 'gray',
    isActive: row.is_active ?? true,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(0),
  };
}

export async function addCategory(data: Omit<Category, 'id' | 'createdAt'>): Promise<string> {
  const { data: inserted, error } = await supabase
    .from('work_categories')
    .insert({
      name: data.name,
      description: data.description,
      color: data.color,
      is_active: data.isActive,
    })
    .select('id')
    .single();
  if (error) throw new Error(`Could not add category: ${error.message}`);
  return String(inserted.id);
}

export async function getCategory(categoryId: string): Promise<Category | undefined> {
  const { data, error } = await supabase
    .from('work_categories')
    .select('*')
    .eq('id', Number(categoryId))
    .maybeSingle();
  if (error) throw new Error(`Could not get category: ${error.message}`);
  return data ? toAppCategory(data) : undefined;
}

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('work_categories')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw new Error(`Could not get categories: ${error.message}`);
  return (data ?? []).map(toAppCategory);
}

export async function updateCategory(categoryId: string, data: Partial<Category>): Promise<void> {
  const payload: CategoryUpdatePayload = {
    name: data.name,
    description: data.description,
    color: data.color,
    is_active: data.isActive,
  };
  (Object.keys(payload) as (keyof CategoryUpdatePayload)[]).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });

  const { error } = await supabase
    .from('work_categories')
    .update(payload)
    .eq('id', Number(categoryId));
  if (error) throw new Error(`Could not update category: ${error.message}`);
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const { error } = await supabase
    .from('work_categories')
    .update({ is_active: false })
    .eq('id', Number(categoryId));
  if (error) throw new Error(`Could not delete category: ${error.message}`);
}

export async function getCategoryUsageCount(categoryId: string): Promise<number> {
  const { count, error } = await supabase
    .from('work_items')
    .select('*', { count: 'exact', head: true })
    .eq('work_category_id', Number(categoryId))
    .eq('type', 'task');
  if (error) throw new Error(`Could not get category usage count: ${error.message}`);
  return count ?? 0;
}
