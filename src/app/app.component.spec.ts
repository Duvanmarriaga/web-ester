import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideMockStore({})
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should dispatch loadAuthFromStorage on init', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const store = TestBed.inject(MockStore);
    spyOn(store, 'dispatch');
    
    fixture.componentInstance.ngOnInit();
    
    expect(store.dispatch).toHaveBeenCalled();
  });
});

import { MockStore } from '@ngrx/store/testing';
