export interface Task {
  id?: number | string;
  owner?: string;
  priority?: string | number;
  status?: string;
  label?: string;
  title?: string;
  description?: string;
}