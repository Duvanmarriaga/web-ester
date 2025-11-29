import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { selectUser } from '../../../infrastructure/store/auth';
import { LucideAngularModule, BarChart2, Activity, TrendingUp, DollarSign, ShoppingCart, PieChart } from 'lucide-angular';
import { NgApexchartsModule } from 'ng-apexcharts';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, NgApexchartsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private store = inject(Store);

  userName = signal('');

  // Lucide icons
  readonly icons = { BarChart2, Activity, TrendingUp, DollarSign, ShoppingCart, PieChart };

  // Chart options - 8 gráficas diferentes
  salesChart: any = {
    series: [{
      name: 'Ventas',
      data: [31000, 40000, 35000, 51000, 49000, 62000, 69000, 91000, 98000, 87000, 105000, 112000]
    }],
    chart: {
      type: 'line',
      height: 280,
      toolbar: { show: false },
      zoom: { enabled: false },
      pan: { enabled: false }
    },
    colors: ['#3b82f6'],
    stroke: { curve: 'smooth', width: 3 },
    xaxis: {
      categories: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    },
    yaxis: {
      labels: {
        formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`
      }
    },
    grid: { borderColor: '#e2e8f0' }
  };

  revenueChart: any = {
    series: [{
      name: 'Ingresos',
      data: [44000, 55000, 57000, 56000, 61000, 58000, 63000, 60000, 66000, 70000, 72000, 75000]
    }],
    chart: {
      type: 'bar',
      height: 280,
      toolbar: { show: false },
      zoom: { enabled: false },
      pan: { enabled: false }
    },
    colors: ['#10b981'],
    plotOptions: {
      bar: {
        borderRadius: 8,
        columnWidth: '60%',
      }
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    },
    yaxis: {
      labels: {
        formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`
      }
    },
    grid: { borderColor: '#e2e8f0' }
  };

  categoriesChart: any = {
    series: [44, 28, 17, 11],
    chart: {
      type: 'pie',
      height: 280,
      zoom: { enabled: false },
      pan: { enabled: false }
    },
    labels: ['Servicios', 'Productos', 'Consultoría', 'Otros'],
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
    legend: { position: 'bottom' },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => `${val.toFixed(1)}%`
    }
  };

  expensesChart: any = {
    series: [35, 25, 20, 12, 8],
    chart: {
      type: 'donut',
      height: 280,
      zoom: { enabled: false },
      pan: { enabled: false }
    },
    labels: ['Salarios', 'Alquiler', 'Servicios', 'Marketing', 'Otros'],
    colors: ['#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#64748b'],
    legend: { position: 'bottom' },
    plotOptions: {
      pie: {
        donut: {
          size: '70%'
        }
      }
    }
  };

  profitChart: any = {
    series: [{
      name: 'Beneficio',
      data: [12000, 15000, 13000, 17000, 16000, 19000, 22000, 27000, 29000, 26000, 31000, 34000]
    }],
    chart: {
      type: 'area',
      height: 280,
      toolbar: { show: false },
      zoom: { enabled: false },
      pan: { enabled: false }
    },
    colors: ['#8b5cf6'],
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.2,
      }
    },
    stroke: { curve: 'smooth', width: 2 },
    xaxis: {
      categories: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    },
    yaxis: {
      labels: {
        formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`
      }
    },
    grid: { borderColor: '#e2e8f0' }
  };

  progressChart: any = {
    series: [76, 67, 89, 54],
    chart: {
      type: 'radialBar',
      height: 280,
      zoom: { enabled: false },
      pan: { enabled: false }
    },
    plotOptions: {
      radialBar: {
        offsetY: 0,
        startAngle: 0,
        endAngle: 270,
        hollow: {
          margin: 5,
          size: '30%',
          background: 'transparent',
        },
        dataLabels: {
          name: { show: false },
          value: { show: false }
        }
      }
    },
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
    labels: ['Ventas', 'Ingresos', 'Clientes', 'Proyectos'],
    legend: {
      show: true,
      floating: true,
      fontSize: '12px',
      position: 'left',
      offsetX: 0,
      offsetY: 15,
      labels: { useSeriesColors: true },
      formatter: function(seriesName: string, opts: any) {
        return seriesName + ":  " + opts.w.globals.series[opts.seriesIndex] + "%"
      },
      itemMargin: { vertical: 3 }
    }
  };

  comparisonChart: any = {
    series: [{
      name: '2024',
      data: [44000, 55000, 41000, 67000, 22000, 43000]
    }, {
      name: '2023',
      data: [35000, 41000, 36000, 26000, 45000, 48000]
    }],
    chart: {
      type: 'bar',
      height: 280,
      toolbar: { show: false },
      zoom: { enabled: false },
      pan: { enabled: false }
    },
    colors: ['#3b82f6', '#64748b'],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '55%',
        borderRadius: 6,
      },
    },
    dataLabels: { enabled: false },
    stroke: {
      show: true,
      width: 2,
      colors: ['transparent']
    },
    xaxis: {
      categories: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
    },
    yaxis: {
      labels: {
        formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`
      }
    },
    fill: { opacity: 1 },
    legend: { position: 'top' },
    grid: { borderColor: '#e2e8f0' }
  };

  mixedChart: any = {
    series: [{
      name: 'Ingresos',
      data: [23000, 11000, 22000, 27000, 13000, 22000, 37000, 21000, 44000, 22000, 30000, 45000]
    }, {
      name: 'Gastos',
      data: [15000, 8000, 13000, 18000, 9000, 15000, 25000, 14000, 30000, 15000, 20000, 32000]
    }, {
      name: 'Beneficio',
      data: [8000, 3000, 9000, 9000, 4000, 7000, 12000, 7000, 14000, 7000, 10000, 13000]
    }],
    chart: {
      height: 280,
      type: 'line',
      stacked: false,
      toolbar: { show: false },
      zoom: { enabled: false },
      pan: { enabled: false }
    },
    colors: ['#3b82f6', '#ef4444', '#10b981'],
    stroke: {
      width: [0, 0, 3],
      curve: 'smooth'
    },
    plotOptions: {
      bar: {
        columnWidth: '50%',
        borderRadius: 4
      }
    },
    fill: {
      opacity: [0.85, 0.85, 1]
    },
    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    xaxis: { type: 'category' },
    yaxis: {
      labels: {
        formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`
      }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'left'
    },
    grid: { borderColor: '#e2e8f0' }
  };

  ngOnInit() {
    this.store.select(selectUser).subscribe(user => {
      if (user) {
        this.userName.set(user.name);
      }
    });
  }
}
