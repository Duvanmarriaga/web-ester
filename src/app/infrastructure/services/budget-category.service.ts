import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface BudgetCategory {
  id: number;
  code: string;
  name: string;
  company_id: number;
}

@Injectable({
  providedIn: 'root',
})
export class BudgetCategoryService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getByCompany(companyId: number): Observable<BudgetCategory[]> {
    return this.http.get<BudgetCategory[]>(
      `${this.apiUrl}/admin/reports/companies/${companyId}/budget-categories`
    ).pipe(
      map((response) => {
        // Handle both array and object with data property
        if (Array.isArray(response)) {
          return response;
        }
        if (response && typeof response === 'object' && 'data' in response) {
          return Array.isArray((response as any).data) ? (response as any).data : [];
        }
        return [];
      }),
      catchError(() => of([]))
    );
  }
}

