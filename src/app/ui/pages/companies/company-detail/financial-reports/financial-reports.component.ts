import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, FileText } from 'lucide-angular';

@Component({
  selector: 'app-financial-reports',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './financial-reports.component.html',
  styleUrl: './financial-reports.component.scss',
})
export class FinancialReportsComponent {
  readonly icons = {
    FileText,
  };
}

