import { TestBed } from '@angular/core/testing';
import { CompanyService } from './company.service';
import { CompanyCreate } from '../../entities/interfaces';

describe('CompanyService', () => {
  let service: CompanyService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CompanyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get all companies', (done) => {
    service.getAll().subscribe((companies) => {
      expect(companies).toBeTruthy();
      expect(companies.length).toBeGreaterThan(0);
      done();
    });
  });

  it('should get company by id', (done) => {
    service.getById('1').subscribe((company) => {
      expect(company).toBeTruthy();
      expect(company.id).toBe('1');
      done();
    });
  });

  it('should fail to get non-existent company', (done) => {
    service.getById('999').subscribe({
      error: (error) => {
        expect(error.message).toBe('Company not found');
        done();
      }
    });
  });

  it('should create new company', (done) => {
    const newCompany: CompanyCreate = {
      name: 'New Company',
      taxId: '111222333',
      email: 'new@company.com',
      phone: '+1234567890',
      address: '123 New Street'
    };

    service.create(newCompany).subscribe((company) => {
      expect(company).toBeTruthy();
      expect(company.name).toBe(newCompany.name);
      expect(company.taxId).toBe(newCompany.taxId);
      done();
    });
  });

  it('should fail to create company with existing tax ID', (done) => {
    const newCompany: CompanyCreate = {
      name: 'Test Company',
      taxId: '123456789', // Already exists
      email: 'test@company.com',
      phone: '+1234567890',
      address: '123 Test Street'
    };

    service.create(newCompany).subscribe({
      error: (error) => {
        expect(error.message).toBe('Tax ID or email already exists');
        done();
      }
    });
  });

  it('should update company', (done) => {
    service.update({ id: '1', name: 'Updated Company' }).subscribe((company) => {
      expect(company).toBeTruthy();
      expect(company.name).toBe('Updated Company');
      done();
    });
  });

  it('should delete company', (done) => {
    service.delete('2').subscribe(() => {
      service.getById('2').subscribe({
        error: (error) => {
          expect(error.message).toBe('Company not found');
          done();
        }
      });
    });
  });
});

