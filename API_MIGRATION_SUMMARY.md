# Resumen de Migración de API - Web ESTER

## Fecha: 2026-01-14

## Cambios Realizados

### 1. Actualización de Rutas de API

Todos los servicios han sido actualizados para usar las nuevas rutas de la API según la especificación OpenAPI proporcionada.

#### Servicios Actualizados:

| Servicio | Ruta Anterior | Ruta Nueva |
|----------|---------------|------------|
| CompanyService | `/admin/companies` | `/companies` |
| UserService | `/admin/users` | `/users` |
| FinancialReportService | `/admin/reports/financial-reports` | `/financial-reports` |
| FinancialReportCategoryService | `/admin/reports/financial-categories` | `/financial-report-categories` |
| BudgetService | `/admin/reports/budgets` | `/operation-budgets` |
| BudgetYearService | `/admin/reports/budget-years` | `/operation-budget-annuals` |
| BudgetCategoryService | `/admin/reports/budget-categories` | `/operation-budget-categories` |
| OperationReportService | `/admin/reports/operations` | `/operation-budgets` |
| OperationCategoryService | `/admin/reports/operation-categories` | `/operation-budget-categories` |
| InvestmentService | `/admin/reports/investments` | `/investment-budgets` |
| InvestmentCategoryService | `/admin/reports/investment-categories` | `/investment-budget-categories` |
| ProcessService | `/admin/reports/processes` | `/processes` |
| ProcessStatusService | `/admin/reports/process-statuses` | `/process-statuses` |
| ProcessStatusHistoryService | `/admin/reports/process-status-history` | `/process-status-histories` |

#### Servicios Nuevos Creados:

1. **ProcessContactService** (`/process-contacts`)
   - Gestión de contactos asociados a procesos legales
   - CRUD completo

2. **FileService** (`/files`)
   - Gestión de archivos de reportes
   - Upload, download, delete
   - Obtener tablas válidas

### 2. Actualización de Interfaces

#### FinancialReport
**Campos eliminados:**
- `income`
- `expenses`
- `profit`
- `document_origin`
- `financial_category_id`

**Campos nuevos:**
- `financial_report_category_id`
- `current_asset`
- `current_passive`
- `inventories`
- `total_passive`
- `total_assets`
- `net_profit`
- `total_revenue`
- `current_value_result`
- `initial_value_of_the_year`
- `budgeted_value`
- `executed_value`
- `current_cash_balance`
- `average_consumption_of_boxes_over_the_last_3_months`

#### FinancialReportCategory
**Campos eliminados:**
- `code`

#### Budget (Operation Budget)
**Cambios:**
- `budget_category_id` → `operation_budget_category_id`
- `budget_year_id` → `operation_budget_annual_id`
- Eliminado `document_origin`

#### Investment
**Estructura simplificada:**
- `investment_category_id` → `investment_budget_category_id`
- Agregado `investment_budget_annual_id`
- Eliminados campos: `investment_date`, `unit_cost`, `quantity`, `total_cost`, `user_id`, `document_origin`
- Nuevo campo simple: `amount`

#### Process
**Campos nuevos:**
- `contact_id` (opcional)

### 3. Cambios en el Diseño

#### Contenedores de Gráficas
- `border-radius`: `0.75rem` → `6px`
- `padding`: agregado `1rem`

#### Dashboards
- Eliminado botón "Buscar" de todos los dashboards
- Ajustados espacios de columnas en filtros
- Los filtros ahora se aplican automáticamente

### 4. Próximos Pasos

#### Pendiente de Revisión:
1. ✅ Servicios actualizados
2. ✅ Interfaces actualizadas
3. ⏳ Componentes de dashboard (en progreso)
4. ⏳ Formularios de reportes financieros
5. ⏳ Formularios de presupuestos
6. ⏳ Formularios de procesos legales

## Notas Importantes

### Breaking Changes
- **CRÍTICO**: Todos los componentes que usan `FinancialReportService` necesitan actualizar sus formularios para incluir los nuevos campos
- **CRÍTICO**: Los componentes de presupuestos e inversiones necesitan actualizar las referencias de `*_category_id` y `*_year_id`
- **IMPORTANTE**: Los formularios deben validar y manejar los nuevos campos requeridos

### Compatibilidad
- ✅ No hay errores de linter en los servicios
- ⚠️ Los componentes existentes pueden tener errores de compilación hasta que se actualicen sus formularios
- ⚠️ Las interfaces de usuario necesitan actualizarse para reflejar los nuevos campos

## Recomendaciones

1. **Probar cada servicio** individualmente antes de desplegar
2. **Actualizar formularios** para incluir todos los campos requeridos
3. **Revisar validaciones** en los formularios según los nuevos requisitos de la API
4. **Actualizar documentación** de usuario si es necesario
5. **Considerar migración de datos** si hay datos existentes en el sistema

## Contacto
Para dudas o problemas con la migración, contactar al equipo de desarrollo.
