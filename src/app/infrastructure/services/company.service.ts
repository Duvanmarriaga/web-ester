import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay, catchError } from 'rxjs/operators';
import {
  Company,
  CompanyCreate,
  CompanyUpdate,
} from '../../entities/interfaces';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class CompanyService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(): Observable<Company[]> {
    return this.http.get<Company[]>(`${this.apiUrl}/admin/companies`);
  }

  getById(id: string): Observable<Company> {
    return this.http.get<Company>(`${this.apiUrl}/admin/companies/${id}`);
  }

  create(companyData: CompanyCreate): Observable<Company> {
    return this.http.post<Company>(
      `${this.apiUrl}/admin/companies`,
      companyData
    );
  }

  update(companyData: CompanyUpdate): Observable<Company> {
    return this.http.put<Company>(
      `${this.apiUrl}/admin/companies/${companyData.id}`,
      companyData
    );
  }

  downloadTemplate(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/admin/reports/budgets/template/download`,
      { responseType: 'arraybuffer' as const }
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/companies/${id}`);
  }

  search(query: string): Observable<Company[]> {
    const params = new HttpParams().set('q', query);
    return this.http.get<Company[]>(`${this.apiUrl}/admin/companies/search`, { params });
  }

  getCompanyUsers(companyId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/admin/companies/${companyId}/users`);
  }

  syncCompanyUsers(companyId: number, userIds: number[]): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/admin/companies/${companyId}/users`,
      { user_ids: userIds }
    );
  }

  assignCompanyUsers(companyId: number, userIds: number[]): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/admin/companies/${companyId}/users`,
      { user_ids: userIds }
    );
  }

  removeCompanyUsers(companyId: number, userIds: number[]): Observable<any> {
    return this.http.request<any>(
      'DELETE',
      `${this.apiUrl}/admin/companies/${companyId}/users`,
      { body: { user_ids: userIds } }
    );
  }
}
