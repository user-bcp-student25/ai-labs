import { Injectable } from '@angular/core';
import axios from 'axios';
import { environment } from '../../environments/environment';
import type { Task } from '../models/task.model';
import { getApiErrorMessage } from '../utils/api-error';

const TASKS_ERROR_FALLBACK = 'No se pudo cargar el dashboard';

@Injectable({ providedIn: 'root' })
export class TasksService {
  async getTasks(username: string, token: string): Promise<Task[]> {
    try {
      const response = await axios.get<Task[]>(`${environment.tasksApiUrl}?owner=${username}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error: unknown) {
      throw new Error(getApiErrorMessage(error, 'detail', TASKS_ERROR_FALLBACK));
    }
  }
}