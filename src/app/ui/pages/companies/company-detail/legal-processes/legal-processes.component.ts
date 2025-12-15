import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Scale } from 'lucide-angular';

@Component({
  selector: 'app-legal-processes',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './legal-processes.component.html',
  styleUrl: './legal-processes.component.scss',
})
export class LegalProcessesComponent {
  readonly icons = {
    Scale,
  };
}

