import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

function initFloatingTableTooltips(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  let tooltipEl: HTMLDivElement | null = null;
  let activeTarget: HTMLElement | null = null;

  const removeTooltip = (): void => {
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
    if (activeTarget) {
      const originalTitle = activeTarget.dataset['tableTooltipTitle'] || '';
      if (originalTitle && !activeTarget.getAttribute('title')) {
        activeTarget.setAttribute('title', originalTitle);
      }
      delete activeTarget.dataset['tableTooltipTitle'];
      activeTarget = null;
    }
  };

  const positionTooltip = (target: HTMLElement): void => {
    if (!tooltipEl) return;
    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const spacing = 8;
    const maxLeft = window.innerWidth - tooltipRect.width - spacing;
    const minLeft = spacing;
    const centeredLeft = rect.left + rect.width / 2 - tooltipRect.width / 2;
    const left = Math.max(minLeft, Math.min(centeredLeft, maxLeft));

    let top = rect.top - tooltipRect.height - spacing;
    if (top < spacing) {
      top = rect.bottom + spacing;
    }

    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
  };

  const showTooltip = (target: HTMLElement): void => {
    if (activeTarget === target) return;
    removeTooltip();
    const title = target.getAttribute('title');
    if (!title || !title.trim()) return;
    if (!target.closest('table')) return;

    target.dataset['tableTooltipTitle'] = title;
    target.removeAttribute('title');
    activeTarget = target;

    tooltipEl = document.createElement('div');
    tooltipEl.textContent = title;
    tooltipEl.style.position = 'fixed';
    tooltipEl.style.zIndex = '2000';
    tooltipEl.style.pointerEvents = 'none';
    tooltipEl.style.padding = '6px 8px';
    tooltipEl.style.borderRadius = '4px';
    tooltipEl.style.background = 'rgba(33, 37, 41, 0.95)';
    tooltipEl.style.color = '#fff';
    tooltipEl.style.fontSize = '12px';
    tooltipEl.style.lineHeight = '1.2';
    tooltipEl.style.maxWidth = '260px';
    tooltipEl.style.whiteSpace = 'normal';
    tooltipEl.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25)';
    document.body.appendChild(tooltipEl);
    positionTooltip(target);
  };

  document.addEventListener(
    'mouseover',
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const withTitle = target.closest<HTMLElement>('[title]');
      if (!withTitle) return;
      showTooltip(withTitle);
    },
    true
  );

  document.addEventListener(
    'mouseout',
    (event) => {
      const related = event.relatedTarget as HTMLElement | null;
      if (activeTarget && related && activeTarget.contains(related)) return;
      if (activeTarget && related && related.closest('table') === activeTarget.closest('table')) {
        const next = related.closest<HTMLElement>('[title]');
        if (next) {
          showTooltip(next);
          return;
        }
      }
      removeTooltip();
    },
    true
  );

  document.addEventListener(
    'focusin',
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const withTitle = target.closest<HTMLElement>('[title]');
      if (!withTitle) return;
      showTooltip(withTitle);
    },
    true
  );

  document.addEventListener(
    'focusout',
    () => {
      removeTooltip();
    },
    true
  );

  window.addEventListener('scroll', () => {
    if (activeTarget) positionTooltip(activeTarget);
  });
  window.addEventListener('resize', () => {
    if (activeTarget) positionTooltip(activeTarget);
  });
}

initFloatingTableTooltips();

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
