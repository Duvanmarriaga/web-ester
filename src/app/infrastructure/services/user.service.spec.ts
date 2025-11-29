import { TestBed } from '@angular/core/testing';
import { UserService } from './user.service';
import { UserCreate, UserRole } from '../../entities/interfaces';

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get all users', (done) => {
    service.getAll().subscribe((users) => {
      expect(users).toBeTruthy();
      expect(users.length).toBeGreaterThan(0);
      done();
    });
  });

  it('should get user by id', (done) => {
    service.getById('1').subscribe((user) => {
      expect(user).toBeTruthy();
      expect(user.id).toBe('1');
      done();
    });
  });

  it('should fail to get non-existent user', (done) => {
    service.getById('999').subscribe({
      error: (error) => {
        expect(error.message).toBe('User not found');
        done();
      }
    });
  });

  it('should create new user', (done) => {
    const newUser: UserCreate = {
      email: 'newuser@example.com',
      password: 'password123',
      firstName: 'New',
      lastName: 'User',
      role: UserRole.USER,
      companyId: '1'
    };

    service.create(newUser).subscribe((user) => {
      expect(user).toBeTruthy();
      expect(user.email).toBe(newUser.email);
      expect(user.firstName).toBe(newUser.firstName);
      done();
    });
  });

  it('should fail to create user with existing email', (done) => {
    const newUser: UserCreate = {
      email: 'admin@example.com', // Already exists
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      role: UserRole.USER,
      companyId: '1'
    };

    service.create(newUser).subscribe({
      error: (error) => {
        expect(error.message).toBe('Email already exists');
        done();
      }
    });
  });

  it('should update user', (done) => {
    service.update({ id: '1', firstName: 'Updated' }).subscribe((user) => {
      expect(user).toBeTruthy();
      expect(user.firstName).toBe('Updated');
      done();
    });
  });

  it('should delete user', (done) => {
    service.delete('2').subscribe(() => {
      service.getById('2').subscribe({
        error: (error) => {
          expect(error.message).toBe('User not found');
          done();
        }
      });
    });
  });

  it('should get users by company', (done) => {
    service.getByCompany('1').subscribe((users) => {
      expect(users).toBeTruthy();
      expect(users.every(u => u.companyId === '1')).toBeTrue();
      done();
    });
  });
});

