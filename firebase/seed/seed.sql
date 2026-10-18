-- BuildLens comprehensive development seed script.
-- Populates organizations, RBAC roles (Director, Manager, Engineer), permissions,
-- projects, villas, levels, rooms, work sections, vendors, employees, tasks,
-- villa workflow events, quality snags & inspections, materials & products,
-- suppliers & purchase orders, safety observations, daily reports, WIRs,
-- documents, and handover packages.

begin;

-- 1. Organization
insert into public.organizations (id, name, slug, classification)
values (
  '00000000-0000-0000-0000-000000000001',
  'Palm Hills & Green Valley Developments',
  'palm-hills-dev',
  'CONFIDENTIAL'
)
on conflict (id) do update
set name = excluded.name;

-- 2. Permissions
insert into public.permissions (id, key, description) values
  ('10000000-0000-0000-0000-000000000001', 'project.read', 'Read project portfolio and metrics'),
  ('10000000-0000-0000-0000-000000000002', 'project.write', 'Create and modify projects, villas, and catalogs'),
  ('10000000-0000-0000-0000-000000000003', 'villa.read.all', 'View all villas across assigned projects'),
  ('10000000-0000-0000-0000-000000000004', 'villa.write', 'Create and edit villa units and phase schedules'),
  ('10000000-0000-0000-0000-000000000005', 'villa.state.upload', 'Upload live villa states in Operations / Villas'),
  ('10000000-0000-0000-0000-000000000006', 'rework.approve', 'Approve rework and clear quality holds'),
  ('10000000-0000-0000-0000-000000000007', 'task.read', 'Read field tasks and finishing workflow activities'),
  ('10000000-0000-0000-0000-000000000008', 'task.write', 'Create and update field tasks and workflow events'),
  ('10000000-0000-0000-0000-000000000009', 'quality.manage', 'Manage quality inspections and snag rectifications'),
  ('10000000-0000-0000-0000-000000000010', 'people.manage', 'Administer employees and RBAC role assignments'),
  ('10000000-0000-0000-0000-000000000011', 'vendor.manage', 'Manage trade contractors and vendor commitments'),
  ('10000000-0000-0000-0000-000000000012', 'handover.manage', 'Manage villa handover packages and readiness items')
on conflict (key) do nothing;

-- 3. Roles (Director, Manager, Engineer)
insert into public.roles (id, organization_id, name, description) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Director', 'Can do anything and see anything across the entire platform.'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Manager', 'Reviews flagged defects and approves rework across villas.'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Engineer', 'Uploads live villa states and progress in the Operations, Villas page.')
on conflict (organization_id, name) do update
set description = excluded.description;

-- Role Permissions
insert into public.role_permissions (role_id, permission_id)
select '20000000-0000-0000-0000-000000000001', id from public.permissions
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select '20000000-0000-0000-0000-000000000002', id from public.permissions
where key in ('project.read', 'villa.read.all', 'rework.approve', 'task.read', 'quality.manage')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select '20000000-0000-0000-0000-000000000003', id from public.permissions
where key in ('project.read', 'villa.read.all', 'villa.state.upload', 'task.read', 'task.write')
on conflict do nothing;

-- 4. Projects
insert into public.projects (id, organization_id, name, project_code, client, location, status, start_date, target_completion_date, description)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Palm Hills Signature Villas — Phase II',
    'BL-PHV-02',
    'Palm Hills Residential Group',
    'Dubai Hills South',
    'ACTIVE',
    '2026-06-01',
    '2027-03-31',
    'Luxury 4BHK & 5BHK residential villa cluster tracked across 6 finishing phases and 89 work activities.'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Green Valley Courtyard Villas',
    'GVV-2026',
    'Green Valley Estates',
    'Bengaluru North',
    'ACTIVE',
    '2026-07-15',
    '2027-06-30',
    '24-unit gated residential villa enclave with parallel GF/FF finishing schedules.'
  )
on conflict (organization_id, project_code) do nothing;

-- 5. Villas
insert into public.villas (id, organization_id, project_id, villa_number, plot_number, block, phase, villa_type, status, target_handover_date, notes)
values
  ('40000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '101', 'P-101', 'Cluster A · North', 'Tiling, marble & threshold works', '4BHK Signature Villa', 'IN_PROGRESS', '2027-01-15', 'GF & FF internal plaster completed; FF bathroom waterproofing tested and cleared for tiling.'),
  ('40000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '102', 'P-102', 'Cluster A · North', 'Services & waterproofing', '4BHK Signature Villa', 'REWORK_REQUIRED', '2027-01-25', 'Ponding test in FF master bath showed dampness near threshold joint. Re-application of 2-coat membrane required before screed.'),
  ('40000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '103', 'P-103', 'Cluster B · East', 'Gypsum, painting, joinery & MEP second fix', '5BHK Courtyard Villa', 'IN_PROGRESS', '2027-01-10', 'Gypsum false ceiling closure and first coat putty running in parallel across GF & FF.'),
  ('40000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '104', 'P-104', 'Cluster B · East', 'External, commissioning & handover', '4BHK Signature Villa', 'COMPLETED', '2026-12-20', 'Final DB dressing, deep cleaning, and snag closure verified. Ready for client key handover.'),
  ('40000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '105', 'P-105', 'Cluster C · South', 'Plaster, gypsum & screeding', '5BHK Courtyard Villa', 'REWORK_REQUIRED', '2027-02-10', 'FF corridor wall plaster plumb tolerance exceeded by 4mm near door frame. Flagged for rectification.'),
  ('40000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '106', 'P-106', 'Cluster C · South', 'Final fix, testing & handover preparation', '4BHK Signature Villa', 'IN_PROGRESS', '2027-01-05', 'Sanitary ware installation and AC diffuser balancing 85% complete.')
on conflict (project_id, villa_number) do nothing;

-- 6. Work Sections (linked to Villa Phases & Work Sections board)
insert into public.work_sections (id, organization_id, name, active) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Services & waterproofing', true),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Plaster, gypsum & screeding', true),
  ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Tiling, marble & threshold works', true),
  ('50000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Gypsum, painting, joinery & MEP second fix', true),
  ('50000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Final fix, testing & handover preparation', true),
  ('50000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'External, commissioning & handover', true)
on conflict (organization_id, name) do nothing;

-- 7. Employees & Teams
insert into public.employees (id, organization_id, employee_code, full_name, phone, status) values
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'DIR-001', 'Arjun Menon (Director)', '+971-50-410-1001', 'ACTIVE'),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'MGR-104', 'Nadia Al-Mansoor (Manager)', '+971-50-410-1002', 'ACTIVE'),
  ('60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'ENG-208', 'Karthik Nair (Site Engineer)', '+971-50-410-1003', 'ACTIVE'),
  ('60000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'ENG-212', 'Zayd Al-Harthi (MEP Engineer)', '+971-50-410-1004', 'ACTIVE'),
  ('60000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'ENG-219', 'Priya Deshmukh (QA/QC Engineer)', '+971-50-410-1005', 'ACTIVE'),
  ('60000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'MGR-109', 'Rohan Kulkarni (Planning Manager)', '+971-50-410-1006', 'ACTIVE')
on conflict (organization_id, employee_code) do nothing;

insert into public.employee_roles (employee_id, role_id, organization_id) values
  ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- 8. Vendors
insert into public.vendors (id, organization_id, company_name, category, status) values
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Al-Futtaim MEP & Finishing Contracting', 'MEP & Finishing', 'ACTIVE'),
  ('70000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Gulf Horizon Joinery & Doors LLC', 'Joinery & Carpentry', 'ACTIVE'),
  ('70000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Emirates Marble & Ceramics Co.', 'Tiling & Marble', 'ACTIVE'),
  ('70000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Apex Waterproofing & Screed Systems', 'Waterproofing', 'ACTIVE'),
  ('70000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Crestline Facade & Glazing Works', 'Windows & External Glazing', 'ACTIVE')
on conflict (organization_id, company_name) do nothing;

-- 9. Tasks
insert into public.tasks (id, organization_id, project_id, villa_id, work_section_id, responsible_employee_id, vendor_id, name, description, status, priority, progress, planned_start_at, planned_end_at)
values
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000102', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000004', 'Rectify FF bathroom threshold waterproofing membrane', 'Re-apply 2-coat cementitious waterproofing membrane and repeat 48-hour ponding test.', 'REWORK_REQUIRED', 'CRITICAL', 40, '2026-10-16T08:00:00Z', '2026-10-20T17:00:00Z'),
  ('80000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000101', '50000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000003', 'Complete FF & GF porcelain floor tiling & grouting', 'Lay 600x1200mm porcelain floor tiles in parallel across GF living and FF bedrooms.', 'IN_PROGRESS', 'HIGH', 65, '2026-10-14T08:00:00Z', '2026-10-24T17:00:00Z'),
  ('80000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000103', '50000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000001', 'Gypsum ceiling closure & MEP second-fix inspection', 'Close MR gypsum boards in wet areas after MEP above-ceiling clearance.', 'IN_PROGRESS', 'HIGH', 78, '2026-10-12T08:00:00Z', '2026-10-22T17:00:00Z'),
  ('80000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000105', '50000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000001', 'Re-plaster FF corridor wall & verify plumb alignment', 'Rectify 4mm plumb deviation on FF corridor wall before putty application.', 'BLOCKED', 'HIGH', 35, '2026-10-15T08:00:00Z', '2026-10-21T17:00:00Z'),
  ('80000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000106', '50000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000002', 'Install fire-rated main entrance & internal timber doors', 'Fit architraves, ironmongery, and acoustic perimeter seals across GF/FF.', 'IN_PROGRESS', 'MEDIUM', 85, '2026-10-10T08:00:00Z', '2026-10-23T17:00:00Z'),
  ('80000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000104', '50000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000001', 'Final MEP testing, commissioning & client handover pack', 'Megger testing, DB labelling, and handover dossier sign-off.', 'COMPLETED', 'MEDIUM', 100, '2026-10-01T08:00:00Z', '2026-10-17T17:00:00Z')
on conflict (id) do nothing;

-- 10. Products, Materials, Suppliers & Purchase Orders
insert into public.products (id, organization_id, name, sku, category, unit, active) values
  ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '2-Component Cementitious Waterproofing Membrane (20kg)', 'WP-CEM-20', 'Waterproofing', 'kits', true),
  ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '600x1200mm Statuario Porcelain Floor Tile', 'TL-POR-60120', 'Tiling & Marble', 'sqm', true),
  ('90000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '12.5mm Moisture-Resistant Gypsum Board', 'GYP-MR-125', 'Gypsum & Ceilings', 'sheets', true),
  ('90000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Low-VOC Acrylic Interior Wall Putty & Primer (25L)', 'PNT-ACR-25', 'Painting', 'drums', true),
  ('90000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Concealed Cistern & Wall-Hung WC Frame Set', 'MEP-SAN-01', 'Sanitary & MEP', 'sets', true)
on conflict (organization_id, sku) do nothing;

insert into public.materials (id, organization_id, product_id, project_id, quantity_on_hand, reorder_level, unit_cost) values
  ('91000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 18, 25, 145.00),
  ('91000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 1420, 400, 68.50),
  ('91000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 310, 120, 32.00),
  ('91000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 14, 20, 210.00),
  ('91000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', 42, 15, 590.00)
on conflict (product_id, project_id) do nothing;

insert into public.suppliers (id, organization_id, company_name, contact_name, phone, email, status) values
  ('92000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Sika Gulf Construction Chemicals', 'Hassan Al-Qasimi', '+971-4-881-2001', 'orders@sikagulf.ae', 'ACTIVE'),
  ('92000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'RAK Ceramics & Stone Supply', 'Vikram Mehta', '+971-7-244-5000', 'projects@rakceramics.com', 'ACTIVE'),
  ('92000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Knauf Middle East Gypsum Systems', 'Samir Haddad', '+971-4-337-7100', 'supply@knauf.ae', 'ACTIVE')
on conflict (organization_id, company_name) do nothing;

insert into public.purchase_orders (id, organization_id, supplier_id, project_id, po_number, status, ordered_at, expected_at, total_amount) values
  ('93000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'PO-2026-0104 · Waterproofing Membrane Replenishment', 'APPROVED', '2026-10-15T09:00:00Z', '2026-10-21', 8700.00),
  ('93000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'PO-2026-0108 · Statuario Porcelain Tile Batch B', 'IN_PROGRESS', '2026-10-16T11:30:00Z', '2026-10-25', 41100.00),
  ('93000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'PO-2026-0112 · MR Gypsum Board & Framing Channels', 'COMPLETED', '2026-10-08T08:00:00Z', '2026-10-14', 15800.00)
on conflict (organization_id, po_number) do nothing;

-- 11. Quality Snags & Inspections
insert into public.snags (id, organization_id, project_id, villa_id, task_id, title, description, severity, status, location_label, due_at) values
  ('94000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000102', '80000000-0000-0000-0000-000000000001', 'FF Master Bath Threshold Waterproofing Dampness', 'Ponding test revealed moisture seepage at doorway upstand fillet; requires 2-coat membrane re-application.', 'CRITICAL', 'OPEN', 'Villa 102 · FF Master Bath', '2026-10-20T17:00:00Z'),
  ('94000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000105', '80000000-0000-0000-0000-000000000004', 'FF Corridor Wall Plaster Plumb Deviation (4mm)', 'Internal cement plaster exceeds 3mm straightedge tolerance adjacent to bedroom B2 door frame.', 'HIGH', 'IN_PROGRESS', 'Villa 105 · FF Corridor', '2026-10-22T17:00:00Z'),
  ('94000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000101', '80000000-0000-0000-0000-000000000002', 'Minor Tile Lippage Near Kitchen Threshold', 'Two porcelain tiles at GF kitchen doorway require re-bedding flush with marble threshold.', 'MEDIUM', 'READY_FOR_VERIFICATION', 'Villa 101 · GF Kitchen', '2026-10-21T17:00:00Z')
on conflict (id) do nothing;

insert into public.inspections (id, organization_id, project_id, villa_id, task_id, inspector_id, inspection_type, status, scheduled_at, notes) values
  ('95000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000101', '80000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000005', 'Wet Area Waterproofing 48h Flood Test', 'PASSED', '2026-10-16T10:00:00Z', 'Zero leakage observed after 48-hour flood test across GF & FF wet rooms.'),
  ('95000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000102', '80000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000005', 'Wet Area Waterproofing 48h Flood Test', 'REWORK_REQUIRED', '2026-10-18T10:30:00Z', 'Threshold dampness detected in FF master bath; flagged for Manager rework sign-off.'),
  ('95000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000103', '80000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000004', 'Above-Ceiling MEP & Gypsum Framing WIR', 'PENDING', '2026-10-20T14:00:00Z', 'Scheduled joint inspection with MEP and gypsum trade supervisors.')
on conflict (id) do nothing;

-- 12. Daily Reports & Safety Observations
insert into public.daily_reports (id, organization_id, project_id, villa_id, report_date, weather, workforce_count, summary, constraints) values
  ('96000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000101', '2026-10-18', 'Clear, 31°C · Light Breeze', 46, 'Completed 85 sqm of Statuario porcelain floor tiling in Villa 101 GF & FF; gypsum ceiling boarding advanced to 78% in Villa 103.', 'Awaiting waterproofing membrane replenishment PO-2026-0104 for Villa 102 rework.'),
  ('96000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000104', '2026-10-17', 'Sunny, 32°C', 38, 'Completed final DB dressing, insulation resistance testing, and deep cleaning in Villa 104 ahead of client walkthrough.', null)
on conflict (id) do nothing;

insert into public.safety_observations (id, organization_id, project_id, villa_id, observation_type, severity, status, description, corrective_action) values
  ('97000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000103', 'OBSERVATION', 'MEDIUM', 'ACTIONED', 'Mobile scaffold tower in Villa 103 double-height lobby lacked toe-board on east side during gypsum installation.', 'Installed toe-board and tagged scaffold green after HSE supervisor re-inspection.'),
  ('97000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000101', 'TOOLBOX_TALK', 'LOW', 'CLOSED', 'Conducted morning toolbox talk on wet-cut tile saw blade guards, respiratory PPE, and cable management.', 'All 22 tiling and masonry operatives signed attendance sheet.')
on conflict (id) do nothing;

-- 13. Handover Packages
insert into public.handover_packages (id, organization_id, project_id, villa_id, status, readiness_score, target_date, customer_name, notes) values
  ('98000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000104', 'READY', 98, '2026-12-20', 'Mr. & Mrs. Tariq Al-Ghurair', 'All MEP test certificates, O&M manuals, and de-snagging sign-offs uploaded.'),
  ('98000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000106', 'IN_REVIEW', 84, '2027-01-05', 'Dr. Ayesha Siddiqui', 'Final sanitary pressure test complete; awaiting AC air-balancing certificate.'),
  ('98000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000103', 'IN_REVIEW', 74, '2027-01-10', 'Mr. Kabir Malhotra', 'Joinery and painting 2nd fix in progress.')
on conflict (villa_id) do nothing;

commit;
