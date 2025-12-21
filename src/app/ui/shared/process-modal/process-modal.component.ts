import {
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  ProcessService,
  ProcessCreate,
  Process,
} from '../../../infrastructure/services/process.service';
import { LucideAngularModule, X } from 'lucide-angular';

@Component({
  selector: 'app-process-modal',
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './process-modal.component.html',
  styleUrl: './process-modal.component.scss',
})
export class ProcessModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private processService = inject(ProcessService);

  // Inputs
  isVisible = input.required<boolean>();
  companyId = input.required<number>();
  process = input<Process | null>(null);

  // Outputs
  close = output<void>();
  save = output<ProcessCreate>();
  update = output<{ id: number; data: ProcessCreate }>();

  processForm!: FormGroup;
  readonly icons = { X };
  isSubmitting = signal(false);
  isEditMode = signal(false);

  readonly processTypes = [
    { value: 'penal', label: 'Penal' },
    { value: 'juridico', label: 'Jurídico' },
  ];

  constructor() {
    effect(() => {
      const currentProcess = this.process();
      const isVisible = this.isVisible();

      if (isVisible && currentProcess) {
        this.isEditMode.set(true);
        setTimeout(() => {
          if (this.processForm) {
            this.populateForm(currentProcess);
          }
        }, 0);
      } else if (isVisible && !currentProcess) {
        this.isEditMode.set(false);
        setTimeout(() => {
          if (this.processForm) {
            this.processForm.reset({
              docket_number: '',
              type: 'penal',
              start_date: '',
              end_date: '',
              description: '',
            });
          }
        }, 0);
      }
    });
  }

  ngOnInit() {
    this.processForm = this.fb.group({
      docket_number: ['', [Validators.required]],
      type: ['penal', [Validators.required]],
      start_date: ['', [Validators.required]],
      end_date: [''],
      description: [''],
    });

    if (this.process() && this.isVisible()) {
      this.isEditMode.set(true);
      this.populateForm(this.process()!);
    }
  }

  populateForm(process: Process): void {
    const startDate = process.start_date
      ? process.start_date.substring(0, 10)
      : '';
    const endDate = process.end_date
      ? process.end_date.substring(0, 10)
      : '';

    this.processForm.patchValue(
      {
        docket_number: process.docket_number,
        type: process.type,
        start_date: startDate,
        end_date: endDate,
        description: process.description || '',
      },
      { emitEvent: false }
    );
  }

  onSubmit() {
    if (this.processForm.invalid) {
      this.processForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const formValue = this.processForm.value;

    const processData: ProcessCreate = {
      company_id: this.companyId(),
      docket_number: formValue.docket_number,
      type: formValue.type,
      start_date: formValue.start_date,
      end_date: formValue.end_date || null,
      description: formValue.description || null,
    };

    if (this.isEditMode() && this.process()?.id) {
      this.update.emit({
        id: this.process()!.id!,
        data: processData,
      });
    } else {
      this.save.emit(processData);
    }

    this.isSubmitting.set(false);
  }

  onClose() {
    this.processForm.reset();
    this.isEditMode.set(false);
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('modal')) {
      this.onClose();
    }
  }
}

