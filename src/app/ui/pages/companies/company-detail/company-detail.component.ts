import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  LucideAngularModule,
  Building2,
  Mail,
  Phone,
  MapPin,
  ArrowLeft,
  FileText,
  TrendingUp,
  DollarSign,
  Scale,
  TrendingDown,
  FolderOpen,
} from 'lucide-angular';
import {
  selectSelectedCompany,
  selectCompanyIsLoading,
  selectCompanyError,
} from '../../../../infrastructure/store/company';
import * as CompanyActions from '../../../../infrastructure/store/company/company.actions';
import { Company } from '../../../../entities/interfaces';

@Component({
  selector: 'app-company-detail',
  imports: [CommonModule, LucideAngularModule, RouterModule, RouterOutlet],
  templateUrl: './company-detail.component.html',
  styleUrl: './company-detail.component.scss',
})
export class CompanyDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private store = inject(Store);

  company = signal<Company | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);
  companyId = signal<string | null>(null);

  readonly icons = {
    Building2,
    Mail,
    Phone,
    MapPin,
    ArrowLeft,
    FileText,
    TrendingUp,
    DollarSign,
    Scale,
    TrendingDown,
    FolderOpen,
  };

  // Computed property to determine active tab from URL
  activeTab = computed(() => {
    const url = this.router.url;
    if (url.includes('/financial')) return 'financial';
    if (url.includes('/operations')) return 'operations';
    if (url.includes('/legal')) return 'legal';
    if (url.includes('/investments')) return 'investments';
    if (url.includes('/documents')) return 'documents';
    return 'financial';
  });

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');

      if (!id) {
        this.router.navigate(['/companies']);
        return;
      }

      this.companyId.set(id);

      // Dispatch load company action
      this.store.dispatch(CompanyActions.loadCompany({ id }));

      // Check if we need to redirect to default tab
      this.route.firstChild?.url.subscribe((segments) => {
        if (segments.length === 0) {
          this.router.navigate(['/companies', id, 'financial'], { replaceUrl: true });
        }
      });
    });

    // Subscribe to loading state
    this.store.select(selectCompanyIsLoading).subscribe((loading) => {
      this.isLoading.set(loading);
    });

    // Subscribe to error state
    this.store.select(selectCompanyError).subscribe((error) => {
      this.error.set(error);
      if (error) {
        // Redirect to companies list on error
        setTimeout(() => {
          this.router.navigate(['/companies']);
        }, 2000);
      }
    });

    // Subscribe to selected company
    this.store.select(selectSelectedCompany).subscribe((company) => {
      if (company) {
        this.company.set(company);
      }
    });
  }

  goBack() {
    this.router.navigate(['/companies']);
  }

  getTabRoute(tab: 'financial' | 'operations' | 'legal' | 'investments' | 'documents'): string[] {
    const id = this.companyId();
    return id ? ['/companies', id, tab] : ['/companies'];
  }
}
