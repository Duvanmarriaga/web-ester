import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, TrendingUp } from 'lucide-angular';

@Component({
  selector: 'app-operations-reports',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './operations-reports.component.html',
  styleUrl: './operations-reports.component.scss',
})
export class OperationsReportsComponent {
  readonly icons = {
    TrendingUp,
  };
}

