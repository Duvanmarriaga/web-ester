import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SidebarComponent } from './sidebar.component';
import { provideRouter } from '@angular/router';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have menu items', () => {
    expect(component.menuItems().length).toBeGreaterThan(0);
  });

  it('should toggle collapse', () => {
    const initialState = component.isCollapsed();
    component.toggleCollapse();
    expect(component.isCollapsed()).toBe(!initialState);
  });

  it('should toggle expanded on menu item', () => {
    const item = component.menuItems()[0];
    const initialExpanded = item.expanded || false;
    component.toggleExpanded(item);
    expect(item.expanded).toBe(!initialExpanded);
  });
});

