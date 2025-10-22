-- ChittyOS Inventory Management Database Schema
-- Includes tenant condition tracking and move-in/move-out compliance

-- Categories table for standardized item categorization
CREATE TABLE categories (
    category_id TEXT PRIMARY KEY,
    category_name TEXT NOT NULL UNIQUE,
    description TEXT,
    parent_category_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_category_id) REFERENCES categories(category_id)
);

-- Locations table for properties and storage units
CREATE TABLE locations (
    location_id TEXT PRIMARY KEY,
    location_name TEXT NOT NULL,
    location_type TEXT NOT NULL CHECK (location_type IN ('Property', 'Storage Unit', 'Warehouse', 'Office')),
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    country TEXT DEFAULT 'USA',
    square_footage INTEGER,
    notes TEXT,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Manufacturers/Brands table
CREATE TABLE manufacturers (
    manufacturer_id TEXT PRIMARY KEY,
    brand_name TEXT NOT NULL UNIQUE,
    contact_info TEXT,
    warranty_info TEXT,
    website TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Items master table - unique items regardless of location
CREATE TABLE items (
    item_id TEXT PRIMARY KEY,
    chitty_id TEXT UNIQUE, -- ChittyID from id.chitty.cc
    category_id TEXT NOT NULL,
    manufacturer_id TEXT,
    item_name TEXT NOT NULL,
    brand_model TEXT,
    description TEXT,
    sku TEXT,
    upc_barcode TEXT,
    serial_number TEXT,
    purchase_date DATE,
    purchase_price DECIMAL(10,2),
    current_value DECIMAL(10,2),
    depreciation_method TEXT CHECK (depreciation_method IN ('Straight-Line', 'MACRS', 'Double-Declining', 'None')),
    warranty_expiration DATE,
    dimensions TEXT, -- JSON format: {"length": 10, "width": 5, "height": 3, "unit": "inches"}
    weight DECIMAL(8,2),
    weight_unit TEXT DEFAULT 'lbs',
    color TEXT,
    material TEXT,
    installation_required BOOLEAN DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(category_id),
    FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(manufacturer_id)
);

-- Inventory table - tracks quantity and condition at each location
CREATE TABLE inventory (
    inventory_id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    condition_rating TEXT NOT NULL CHECK (condition_rating IN ('New', 'Like New', 'Excellent', 'Good', 'Fair', 'Poor', 'Needs Repair', 'Damaged')),
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'In Storage', 'For Sale', 'Under Maintenance', 'Disposed', 'Missing', 'Reserved')),
    room_location TEXT, -- Specific room/area within the location
    position_details TEXT, -- Specific position/shelf/etc.
    last_inspected DATETIME,
    next_inspection_due DATETIME,
    qr_code TEXT UNIQUE,
    photo_urls TEXT, -- JSON array of photo URLs
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(item_id),
    FOREIGN KEY (location_id) REFERENCES locations(location_id),
    UNIQUE(item_id, location_id, room_location)
);

-- Tenants table for property management
CREATE TABLE tenants (
    tenant_id TEXT PRIMARY KEY,
    chitty_id TEXT UNIQUE, -- ChittyID from id.chitty.cc
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    lease_start_date DATE,
    lease_end_date DATE,
    security_deposit DECIMAL(10,2),
    monthly_rent DECIMAL(10,2),
    active BOOLEAN DEFAULT 1,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tenant occupancy - links tenants to locations with dates
CREATE TABLE tenant_occupancy (
    occupancy_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    move_in_date DATE NOT NULL,
    move_out_date DATE,
    lease_status TEXT DEFAULT 'Active' CHECK (lease_status IN ('Active', 'Terminated', 'Expired', 'Pending')),
    security_deposit_amount DECIMAL(10,2),
    security_deposit_returned DECIMAL(10,2),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    FOREIGN KEY (location_id) REFERENCES locations(location_id)
);

-- Condition inspections for move-in/move-out compliance
CREATE TABLE condition_inspections (
    inspection_id TEXT PRIMARY KEY,
    occupancy_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    inspection_type TEXT NOT NULL CHECK (inspection_type IN ('Move-In', 'Move-Out', 'Routine', 'Emergency', 'Pre-Sale')),
    inspection_date DATETIME NOT NULL,
    inspector_name TEXT NOT NULL,
    tenant_present BOOLEAN DEFAULT 0,
    tenant_signature TEXT, -- Base64 encoded signature
    landlord_signature TEXT, -- Base64 encoded signature
    overall_condition TEXT CHECK (overall_condition IN ('Excellent', 'Good', 'Fair', 'Poor')),
    notes TEXT,
    photos TEXT, -- JSON array of general property photos
    completed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (occupancy_id) REFERENCES tenant_occupancy(occupancy_id),
    FOREIGN KEY (location_id) REFERENCES locations(location_id)
);

-- Item condition records for specific items during inspections
CREATE TABLE item_condition_records (
    record_id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL,
    inventory_id TEXT NOT NULL,
    condition_before TEXT CHECK (condition_before IN ('New', 'Like New', 'Excellent', 'Good', 'Fair', 'Poor', 'Needs Repair', 'Damaged')),
    condition_after TEXT CHECK (condition_after IN ('New', 'Like New', 'Excellent', 'Good', 'Fair', 'Poor', 'Needs Repair', 'Damaged')),
    damage_description TEXT,
    repair_needed BOOLEAN DEFAULT 0,
    repair_cost_estimate DECIMAL(10,2),
    tenant_responsible BOOLEAN DEFAULT 0,
    photos TEXT, -- JSON array of item-specific photos
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inspection_id) REFERENCES condition_inspections(inspection_id),
    FOREIGN KEY (inventory_id) REFERENCES inventory(inventory_id)
);

-- Transactions table for tracking item movements, sales, maintenance
CREATE TABLE transactions (
    transaction_id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('Transfer', 'Sale', 'Purchase', 'Maintenance', 'Disposal', 'Loss', 'Found')),
    from_location_id TEXT,
    to_location_id TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    transaction_date DATETIME NOT NULL,
    handled_by TEXT,
    cost DECIMAL(10,2), -- Cost of transaction (maintenance cost, sale price, etc.)
    reference_number TEXT, -- Receipt number, invoice number, etc.
    receipt_image TEXT, -- URL to receipt image
    description TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(item_id),
    FOREIGN KEY (from_location_id) REFERENCES locations(location_id),
    FOREIGN KEY (to_location_id) REFERENCES locations(location_id)
);

-- Maintenance records
CREATE TABLE maintenance_records (
    maintenance_id TEXT PRIMARY KEY,
    inventory_id TEXT NOT NULL,
    maintenance_type TEXT NOT NULL CHECK (maintenance_type IN ('Repair', 'Cleaning', 'Replacement', 'Upgrade', 'Inspection')),
    scheduled_date DATETIME,
    completed_date DATETIME,
    performed_by TEXT,
    cost DECIMAL(10,2),
    description TEXT NOT NULL,
    parts_used TEXT, -- JSON array of parts/materials
    warranty_work BOOLEAN DEFAULT 0,
    before_photos TEXT, -- JSON array
    after_photos TEXT, -- JSON array
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(inventory_id)
);

-- Document attachments (receipts, manuals, warranties, etc.)
CREATE TABLE document_attachments (
    document_id TEXT PRIMARY KEY,
    item_id TEXT,
    inspection_id TEXT,
    transaction_id TEXT,
    maintenance_id TEXT,
    document_type TEXT NOT NULL CHECK (document_type IN ('Receipt', 'Manual', 'Warranty', 'Photo', 'Inspection Report', 'Other')),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    description TEXT,
    uploaded_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(item_id),
    FOREIGN KEY (inspection_id) REFERENCES condition_inspections(inspection_id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id),
    FOREIGN KEY (maintenance_id) REFERENCES maintenance_records(maintenance_id)
);

-- Users table for system access
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    chitty_id TEXT UNIQUE, -- ChittyID from id.chitty.cc
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role TEXT NOT NULL DEFAULT 'User' CHECK (role IN ('Admin', 'Manager', 'User', 'Tenant', 'Inspector')),
    permissions TEXT, -- JSON array of specific permissions
    active BOOLEAN DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit log for tracking all changes
CREATE TABLE audit_log (
    log_id TEXT PRIMARY KEY,
    user_id TEXT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values TEXT, -- JSON of previous values
    new_values TEXT, -- JSON of new values
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Indexes for performance
CREATE INDEX idx_items_category ON items(category_id);
CREATE INDEX idx_items_chitty_id ON items(chitty_id);
CREATE INDEX idx_inventory_location ON inventory(location_id);
CREATE INDEX idx_inventory_item ON inventory(item_id);
CREATE INDEX idx_inventory_status ON inventory(status);
CREATE INDEX idx_inspections_occupancy ON condition_inspections(occupancy_id);
CREATE INDEX idx_inspections_date ON condition_inspections(inspection_date);
CREATE INDEX idx_transactions_item ON transactions(item_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_maintenance_inventory ON maintenance_records(inventory_id);
CREATE INDEX idx_documents_item ON document_attachments(item_id);
CREATE INDEX idx_audit_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);

-- Insert default categories
INSERT INTO categories (category_id, category_name, description) VALUES
('CAT001', 'Bedroom', 'Items used in bedrooms'),
('CAT002', 'Kitchen', 'Kitchen appliances and utensils'),
('CAT003', 'Bathroom', 'Bathroom fixtures and linens'),
('CAT004', 'Living Room', 'Furniture and electronics for living areas'),
('CAT005', 'Dining Room', 'Dining furniture and accessories'),
('CAT006', 'Laundry Room', 'Laundry appliances and tools'),
('CAT007', 'All Rooms', 'Items present in multiple rooms'),
('CAT008', 'Storage', 'Items stored for future use'),
('CAT009', 'Electronics', 'Electronic devices and accessories'),
('CAT010', 'Appliances', 'Large and small appliances'),
('CAT011', 'Outdoor', 'Outdoor furniture and equipment'),
('CAT012', 'Office', 'Office furniture and equipment'),
('CAT013', 'Decor', 'Decorative items and artwork');