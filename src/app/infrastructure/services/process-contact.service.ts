import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../../entities/interfaces/pagination.interface';

export interface ProcessContact {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  company_id: number;
}

export interface ProcessContactCreate {
  name: string;
  email?: string | null;
  phone?: string | null;
  company_id: number;
}

export interface ProcessContactUpdate {
  name?: string;
  email?: string | null;
  phone?: string | null;
  company_id?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProcessContactService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(
    companyId?: number,
    name?: string,
    email?: string,
    phone?: string,
    page?: number,
    perPage?: number
  ): Observable<ProcessContact[] | PaginatedResponse<ProcessContact>> {
    let params = new HttpParams();
    
    if (companyId) {
      params = params.set('company_id', companyId.toString());
    }
    if (name) {
      params = params.set('name', name);
    }
    if (email) {
      params = params.set('email', email);
    }
    if (phone) {
      params = params.set('phone', phone);
    }
    if (page) {
      params = params.set('page', page.toString());
    }
    if (perPage) {
      params = params.set('per_page', perPage.toString());
    }
    
    return this.http.get<ProcessContact[] | PaginatedResponse<ProcessContact>>(
      `${this.apiUrl}/process-contacts`,
      { params }
    );
  }

  getById(id: number): Observable<ProcessContact> {
    return this.http.get<ProcessContact>(
      `${this.apiUrl}/process-contacts/${id}`
    );
  }

  create(contactData: ProcessContactCreate): Observable<ProcessContact> {
    return this.http.post<ProcessContact>(
      `${this.apiUrl}/process-contacts`,
      contactData
    );
  }

  update(id: number, contactData: ProcessContactUpdate): Observable<ProcessContact> {
    return this.http.put<ProcessContact>(
      `${this.apiUrl}/process-contacts/${id}`,
      contactData
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/process-contacts/${id}`
    );
  }
}
