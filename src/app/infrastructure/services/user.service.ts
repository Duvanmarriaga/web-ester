import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, UserCreate, UserUpdate } from '../../entities/interfaces';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  private nextId = 4;

  getAll(): Observable<User[]> {
    // Petición HTTP real
    return this.http.get<User[]>(`${this.apiUrl}/admin/users`);
  }

  getById(id: number): Observable<User> {
    // Petición HTTP real
    return this.http.get<User>(`${this.apiUrl}/admin/users/${id}`);
  }

  create(userData: UserCreate): Observable<User> {
    // Petición HTTP real
    return this.http.post<User>(`${this.apiUrl}/admin/users`, userData);
  }

  update(userData: UserUpdate): Observable<User> {
    // Petición HTTP real
    return this.http.put<User>(
      `${this.apiUrl}/admin/users/${userData.id}`,
      userData
    );
  }

  delete(id: number): Observable<void> {
    // Petición HTTP real
    return this.http.delete<void>(`${this.apiUrl}/admin/users/${id}`);
  }

  getByCompany(companyId: string): Observable<User[]> {
    return this.http.get<User[]>(
      `${this.apiUrl}/admin/users/company/${companyId}`
    );
  }
}
