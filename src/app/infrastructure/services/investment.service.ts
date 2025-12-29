import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../../entities/interfaces/pagination.interface';

export interface Investment {
  id?: number;
  investment_category_id: number;
  company_id: number;
  investment_date: string;
  unit_cost: number;
  quantity: number;
  total_cost: number;
  user_id: number;
  document_origin?: string | null;
}

export interface InvestmentCreate {
  investment_category_id: number;
  company_id: number;
  investment_date: string;
  unit_cost: number;
  quantity: number;
  total_cost: number;
  user_id: number;
  document_origin?: string | null;
}

export interface InvestmentUpdate {
  investment_category_id?: number;
  company_id?: number;
  investment_date?: string;
  unit_cost?: number;
  quantity?: number;
  total_cost?: number;
  user_id?: number;
  document_origin?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class InvestmentService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(page: number = 1, perPage: number = 15, companyId?: number): Observable<PaginatedResponse<Investment>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());
    
    if (companyId) {
      params = params.set('company_id', companyId.toString());
    }
    
    return this.http.get<PaginatedResponse<Investment>>(
      `${this.apiUrl}/admin/reports/investments`,
      { params }
    );
  }

  getById(id: number): Observable<Investment> {
    return this.http.get<Investment>(
      `${this.apiUrl}/admin/reports/investments/${id}`
    );
  }

  create(investmentData: InvestmentCreate): Observable<Investment> {
    return this.http.post<Investment>(
      `${this.apiUrl}/admin/reports/investments`,
      investmentData
    );
  }

  update(id: number, investmentData: InvestmentUpdate): Observable<Investment> {
    return this.http.put<Investment>(
      `${this.apiUrl}/admin/reports/investments/${id}`,
      investmentData
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/admin/reports/investments/${id}`
    );
  }

  downloadTemplate(): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/admin/reports/investments/template/download`,
      { responseType: 'blob' }
    );
  }

  import(file: File): Observable<{ message?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ message?: string }>(
      `${this.apiUrl}/admin/reports/investments/import`,
      formData
    );
  }
}

