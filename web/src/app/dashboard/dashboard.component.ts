import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import type { AuthenticatedUser } from '../models/auth.models';
import type { Task } from '../models/task.model';
import { AuthService } from '../services/auth.service';
import { TasksService } from '../services/tasks.service';
import { formatTaskLabel } from '../utils/legacy-format';

const STATUS_LABELS: Record<string, string> = {
  TODO: 'Por hacer',
  IN_PROGRESS: 'En progreso',
  DONE: 'Completado',
  RESUELTO: 'Resuelto',
  COMPLETED: 'Completado'
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  tasks: Task[] = [];
  visibleTasks: Task[] = [];
  user: AuthenticatedUser = { username: '' };
  loading = true;
  error = '';

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private authService: AuthService,
    private tasksService: TasksService
  ) {}

  statusLabel(status?: string): string {
    return STATUS_LABELS[(status || '').toUpperCase()] || status || '';
  }

  async ngOnInit(): Promise<void> {
    const hasSession = this.authService.hasSession();
    this.user = this.authService.getUser() ?? { username: '' };
    if (!hasSession) {
      await this.router.navigate(['/login']);
      return;
    }

    try {
      const tasks = await this.tasksService.getTasks(this.user.username || '');
      const visibleTasks = tasks.filter((task) => task.status !== 'ARCHIVED');
      for (const task of visibleTasks) {
        task.label = formatTaskLabel(task);
      }
      visibleTasks.sort((firstTask, secondTask) => firstTask.priority! > secondTask.priority! ? -1 : 1);

      // axios resuelve a veces fuera de la zona de Angular (más aún llegando
      // por navegación desde el login): forzamos volver a entrar a la zona
      // y disparamos detectChanges a mano para no depender de que Angular
      // lo detecte solo.
      this.zone.run(() => {
        this.tasks = tasks;
        this.visibleTasks = visibleTasks;
        this.loading = false;
        this.cdr.detectChanges();
      });
    } catch (error: unknown) {
      this.zone.run(() => {
        this.error = error instanceof Error ? error.message : 'No se pudo cargar el dashboard';
        this.loading = false;
        this.cdr.detectChanges();
      });
    }
  }

  async logout(): Promise<void> {
    this.authService.clearSession();
    await this.router.navigate(['/login']);
  }
}
