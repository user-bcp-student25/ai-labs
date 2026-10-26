import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import type { LoginMessage, UserPreferences } from '../models/auth.models';

const AUTH_CLIENT_ID = 'angular-workshop';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username = '';
  password = '';
  busy = false;
  message: LoginMessage | null = null;
  preferences: UserPreferences;

  constructor(private router: Router, private authService: AuthService) {
    this.preferences = this.authService.getPreferences();
  }

  async login(): Promise<void> {
    this.message = null;
    if (!this.username.trim()) {
      this.message = { title: 'Ingrese un usuario.' };
      return;
    }
    if (!this.password.trim()) {
      this.message = { title: 'Ingrese una contraseña.' };
      return;
    }

    this.busy = true;
    try {
      const response = await this.authService.login({
        username: this.username,
        password: this.password,
        client: AUTH_CLIENT_ID
      });
      if (!response.token) {
        this.message = { title: 'El backend respondió sin token.' };
        return;
      }

      this.authService.saveSession(response.token, response.user);
      this.authService.savePreferences(this.preferences);
      await this.router.navigate(['/dashboard']);
    } catch (error: unknown) {
      this.message = {
        title: `No se pudo autenticar a ${this.username}.`,
        detail: this.authService.getLoginErrorMessage(error)
      };
    } finally {
      this.busy = false;
    }
  }
}
