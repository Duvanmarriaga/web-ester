import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, UserCreate, UserUpdate } from '../../entities/interfaces';
import { Company } from '../../entities/interfaces/company.interface';
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

  getUserCompanies(userId: number): Observable<Company[]> {
    return this.http.get<Company[]>(
      `${this.apiUrl}/admin/users/${userId}/companies`
    );
  }

  syncUserCompanies(userId: number, companyIds: number[]): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/admin/users/${userId}/companies`,
      { companies_ids: companyIds }
    );
  }

  assignUserCompanies(userId: number, companyIds: number[]): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/admin/users/${userId}/companies`,
      { companies_ids: companyIds }
    );
  }

  removeUserCompanies(userId: number, companyIds: number[]): Observable<any> {
    return this.http.request<any>(
      'DELETE',
      `${this.apiUrl}/admin/users/${userId}/companies`,
      { body: { companies_ids: companyIds } }
    );
  }
}
