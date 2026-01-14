import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import {
  selectAllCompanies,
  selectCompanyIsLoading,
} from '../../../infrastructure/store/company';
import * as CompanyActions from '../../../infrastructure/store/company/company.actions';
import { Company, CompanyCreate, CompanyUpdate } from '../../../entities/interfaces';
import {
  LucideAngularModule,
  Building2,
  Pencil,
  Trash2,
  Mail,
  Phone,
  MapPin,
  ArrowRight,
} from 'lucide-angular';
import { Router } from '@angular/router';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { CompanyModalComponent } from '../../shared/company-modal/company-modal.component';

@Component({
  selector: 'app-companies',
  imports: [
    CommonModule,
    LucideAngularModule,
    ConfirmDialogComponent,
    CompanyModalComponent,
  ],
  templateUrl: './companies.component.html',
  styleUrl: './companies.component.scss',
})
export class CompaniesComponent implements OnInit {
  private store = inject(Store);
  private router = inject(Router);
  companies = signal<Company[]>([]);
  isLoading = signal(false);
  showModal = signal(false);
  showConfirmDialog = signal(false);
  editingCompany = signal<Company | null>(null);
  deletingCompany = signal<Company | null>(null);

  // Lucide icons
  readonly icons = { Building2, Pencil, Trash2, Mail, Phone, MapPin, ArrowRight };

  ngOnInit() {
    this.store
      .select(selectAllCompanies)
      .subscribe((companies) => this.companies.set(companies));
    this.store
      .select(selectCompanyIsLoading)
      .subscribe((loading) => this.isLoading.set(loading));

    this.store.dispatch(CompanyActions.loadCompanies());
  }

  openCreateModal() {
    this.editingCompany.set(null);
    this.showModal.set(true);
  }

  openEditModal(company: Company) {
    this.editingCompany.set(company);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingCompany.set(null);
  }

  onSaveCompany(event: { company: CompanyCreate | CompanyUpdate }) {
    const editing = this.editingCompany();
    if (editing) {
      this.store.dispatch(
        CompanyActions.updateCompany({
          company: event.company as CompanyUpdate,
        })
      );
    } else {
      this.store.dispatch(
        CompanyActions.createCompany({
          company: event.company as CompanyCreate,
        })
      );
    }
    this.closeModal();
  }

  deleteCompany(company: Company) {
    this.deletingCompany.set(company);
    this.showConfirmDialog.set(true);
  }

  confirmDelete() {
    const company = this.deletingCompany();
    if (company) {
      this.store.dispatch(CompanyActions.deleteCompany({ id: company.id }));
    }
    this.showConfirmDialog.set(false);
    this.deletingCompany.set(null);
  }

  cancelDelete() {
    this.showConfirmDialog.set(false);
    this.deletingCompany.set(null);
  }

  getDeleteMessage(): string {
    const company = this.deletingCompany();
    return company
      ? `¿Estás seguro de que deseas eliminar la compañía ${company.name}? Esta acción no se puede deshacer.`
      : '';
  }

  navigateToDetail(companyId: number) {
    this.router.navigate(['/companies', companyId]);
  }
}
