import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface BudgetYear {
  id: number;
  company_id: number;
  year: number;
  amount: number;
  allocated_budget: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetYearCreate {
  company_id: number;
  year: number;
  amount: number;
}

export interface BudgetYearUpdate {
  amount: number;
}

@Injectable({
  providedIn: 'root',
})
export class BudgetYearService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(companyId: number, year?: number): Observable<BudgetYear[]> {
    let params = new HttpParams().set('company_id', companyId.toString());
    
    if (year) {
      params = params.set('year', year.toString());
    }
    
    return this.http.get<BudgetYear[]>(
      `${this.apiUrl}/admin/reports/budget-years`,
      { params }
    );
  }

  create(budgetYearData: BudgetYearCreate): Observable<BudgetYear> {
    return this.http.post<BudgetYear>(
      `${this.apiUrl}/admin/reports/budget-years`,
      budgetYearData
    );
  }

  update(id: number, budgetYearData: BudgetYearUpdate): Observable<BudgetYear> {
    return this.http.put<BudgetYear>(
      `${this.apiUrl}/admin/reports/budget-years/${id}`,
      budgetYearData
    );
  }
}





