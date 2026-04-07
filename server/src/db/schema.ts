import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const internalDeviceStatusEnum = pgEnum('internal_device_status_enum', [
  'Recibido',
  'Pendiente',
  'En diagnóstico',
  'Esperando aprobación',
  'En reparación',
  'Reparado',
  'Listo para entregar',
  'Entregado',
  'Cancelado',
  'No reparable',
]);

export const customerVisibleStatusEnum = pgEnum('customer_visible_status_enum', ['Pendiente', 'En reparación', 'Listo', 'Entregado']);

export const paymentMethodEnum = pgEnum('payment_method_enum', ['efectivo', 'transferencia', 'tarjeta', 'otro']);

export const inventoryMovementTypeEnum = pgEnum('inventory_movement_type_enum', [
  'entrada',
  'salida',
  'ajuste',
  'transferencia_salida',
  'transferencia_entrada',
  'venta',
]);

export const inventoryTransferStatusEnum = pgEnum('inventory_transfer_status_enum', ['creada', 'en_transito', 'completada', 'cancelada']);

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 80 }).notNull().unique(),
  description: text('description').notNull(),
  ...timestamps,
});

export const branches = pgTable(
  'branches',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 140 }).notNull(),
    code: varchar('code', { length: 25 }).notNull().unique(),
    address: text('address').notNull(),
    phone: varchar('phone', { length: 30 }).notNull(),
    managerName: varchar('manager_name', { length: 140 }),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('idx_branches_code').on(table.code), index('idx_branches_is_active').on(table.isActive)],
);

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    fullName: varchar('full_name', { length: 160 }).notNull(),
    usernameOrEmail: varchar('username_or_email', { length: 140 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    roleId: integer('role_id').notNull().references(() => roles.id),
    branchId: integer('branch_id').references(() => branches.id),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_users_username_or_email').on(table.usernameOrEmail),
    index('idx_users_role_id').on(table.roleId),
    index('idx_users_branch_id').on(table.branchId),
    index('idx_users_is_active').on(table.isActive),
  ],
);

export const customers = pgTable(
  'customers',
  {
    id: serial('id').primaryKey(),
    fullName: varchar('full_name', { length: 180 }).notNull(),
    phone: varchar('phone', { length: 30 }).notNull(),
    nationalId: varchar('national_id', { length: 40 }),
    address: text('address'),
    email: varchar('email', { length: 160 }),
    alertNote: text('alert_note'),
    ...timestamps,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    unique('uniq_customers_full_name_phone').on(table.fullName, table.phone),
    index('idx_customers_full_name').on(table.fullName),
    index('idx_customers_phone').on(table.phone),
    index('idx_customers_national_id').on(table.nationalId),
  ],
);

export const deviceTypes = pgTable('device_types', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 80 }).notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

export const devices = pgTable(
  'devices',
  {
    id: serial('id').primaryKey(),
    deviceNumber: varchar('device_number', { length: 20 }).notNull().unique(),
    deviceSequenceNumber: integer('device_sequence_number').notNull().unique(),
    customerId: integer('customer_id').notNull().references(() => customers.id),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    technicianId: integer('technician_id').references(() => users.id),
    deviceTypeId: integer('device_type_id').notNull().references(() => deviceTypes.id),
    brand: varchar('brand', { length: 80 }).notNull(),
    model: varchar('model', { length: 120 }).notNull(),
    color: varchar('color', { length: 40 }),
    imeiOrSerial: varchar('imei_or_serial', { length: 120 }),
    pinPatternPassword: varchar('pin_pattern_password', { length: 120 }),
    storageCapacity: varchar('storage_capacity', { length: 80 }),
    batteryInfo: varchar('battery_info', { length: 80 }),
    accessoriesReceived: jsonb('accessories_received'),
    physicalObservations: text('physical_observations'),
    reportedIssue: text('reported_issue').notNull(),
    initialDiagnosis: text('initial_diagnosis'),
    internalObservations: text('internal_observations'),
    internalStatus: internalDeviceStatusEnum('internal_status').notNull(),
    customerVisibleStatus: customerVisibleStatusEnum('customer_visible_status').notNull(),
    repairTotal: numeric('repair_total', { precision: 12, scale: 2 }).notNull().default('0'),
    initialPayment: numeric('initial_payment', { precision: 12, scale: 2 }).notNull().default('0'),
    pendingBalance: numeric('pending_balance', { precision: 12, scale: 2 }).notNull().default('0'),
    priority: varchar('priority', { length: 30 }),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    estimatedDeliveryAt: timestamp('estimated_delivery_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    customerVisibleNote: text('customer_visible_note'),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_devices_device_number').on(table.deviceNumber),
    index('idx_devices_device_sequence_number').on(table.deviceSequenceNumber),
    index('idx_devices_customer_id').on(table.customerId),
    index('idx_devices_branch_id').on(table.branchId),
    index('idx_devices_technician_id').on(table.technicianId),
    index('idx_devices_device_type_id').on(table.deviceTypeId),
    index('idx_devices_imei_or_serial').on(table.imeiOrSerial),
    index('idx_devices_internal_status').on(table.internalStatus),
    index('idx_devices_customer_visible_status').on(table.customerVisibleStatus),
    index('idx_devices_received_at').on(table.receivedAt),
    index('idx_devices_created_at').on(table.createdAt),
    check('chk_devices_repair_total_non_negative', sql`${table.repairTotal} >= 0`),
    check('chk_devices_initial_payment_non_negative', sql`${table.initialPayment} >= 0`),
    check('chk_devices_pending_balance_non_negative', sql`${table.pendingBalance} >= 0`),
  ],
);

export const deviceStatusHistory = pgTable(
  'device_status_history',
  {
    id: serial('id').primaryKey(),
    deviceId: integer('device_id').notNull().references(() => devices.id),
    previousStatus: internalDeviceStatusEnum('previous_status'),
    newStatus: internalDeviceStatusEnum('new_status').notNull(),
    internalNote: text('internal_note'),
    visibleToCustomer: boolean('visible_to_customer').notNull().default(false),
    changedByUserId: integer('changed_by_user_id').notNull().references(() => users.id),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_device_status_history_device_id').on(table.deviceId),
    index('idx_device_status_history_changed_by').on(table.changedByUserId),
    index('idx_device_status_history_branch_id').on(table.branchId),
    index('idx_device_status_history_created_at').on(table.createdAt),
  ],
);

export const devicePayments = pgTable(
  'device_payments',
  {
    id: serial('id').primaryKey(),
    deviceId: integer('device_id').notNull().references(() => devices.id),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    reference: varchar('reference', { length: 120 }),
    note: text('note'),
    createdByUserId: integer('created_by_user_id').notNull().references(() => users.id),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_device_payments_device_id').on(table.deviceId),
    index('idx_device_payments_created_by').on(table.createdByUserId),
    index('idx_device_payments_branch_id').on(table.branchId),
    index('idx_device_payments_created_at').on(table.createdAt),
    check('chk_device_payments_amount_positive', sql`${table.amount} > 0`),
  ],
);

export const productCategories = pgTable('product_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull().unique(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 160 }).notNull(),
    sku: varchar('sku', { length: 80 }),
    categoryId: integer('category_id').notNull().references(() => productCategories.id),
    brand: varchar('brand', { length: 100 }),
    model: varchar('model', { length: 120 }),
    description: text('description'),
    cost: numeric('cost', { precision: 12, scale: 2 }).notNull().default('0'),
    salePrice: numeric('sale_price', { precision: 12, scale: 2 }).notNull().default('0'),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('uniq_products_sku').on(table.sku),
    index('idx_products_category_id').on(table.categoryId),
    index('idx_products_brand').on(table.brand),
    index('idx_products_name').on(table.name),
    index('idx_products_is_active').on(table.isActive),
    check('chk_products_cost_non_negative', sql`${table.cost} >= 0`),
    check('chk_products_sale_price_non_negative', sql`${table.salePrice} >= 0`),
  ],
);

export const inventories = pgTable(
  'inventories',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id').notNull().references(() => products.id),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    currentStock: integer('current_stock').notNull().default(0),
    minimumStock: integer('minimum_stock').notNull().default(0),
    ...timestamps,
  },
  (table) => [
    unique('uniq_inventories_product_branch').on(table.productId, table.branchId),
    index('idx_inventories_product_id').on(table.productId),
    index('idx_inventories_branch_id').on(table.branchId),
    index('idx_inventories_current_stock').on(table.currentStock),
    check('chk_inventories_current_stock_non_negative', sql`${table.currentStock} >= 0`),
    check('chk_inventories_minimum_stock_non_negative', sql`${table.minimumStock} >= 0`),
  ],
);

export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id').notNull().references(() => products.id),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    movementType: inventoryMovementTypeEnum('movement_type').notNull(),
    quantity: integer('quantity').notNull(),
    previousStock: integer('previous_stock').notNull(),
    newStock: integer('new_stock').notNull(),
    referenceType: varchar('reference_type', { length: 60 }),
    referenceId: integer('reference_id'),
    note: text('note'),
    createdByUserId: integer('created_by_user_id').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_inventory_movements_product_id').on(table.productId),
    index('idx_inventory_movements_branch_id').on(table.branchId),
    index('idx_inventory_movements_movement_type').on(table.movementType),
    index('idx_inventory_movements_created_by').on(table.createdByUserId),
    index('idx_inventory_movements_created_at').on(table.createdAt),
    index('idx_inventory_movements_reference_type').on(table.referenceType),
    index('idx_inventory_movements_reference_id').on(table.referenceId),
    check('chk_inventory_movements_quantity_positive', sql`${table.quantity} > 0`),
    check('chk_inventory_movements_previous_stock_non_negative', sql`${table.previousStock} >= 0`),
    check('chk_inventory_movements_new_stock_non_negative', sql`${table.newStock} >= 0`),
  ],
);

export const inventoryTransfers = pgTable(
  'inventory_transfers',
  {
    id: serial('id').primaryKey(),
    originBranchId: integer('origin_branch_id').notNull().references(() => branches.id),
    destinationBranchId: integer('destination_branch_id').notNull().references(() => branches.id),
    status: inventoryTransferStatusEnum('status').notNull().default('creada'),
    note: text('note'),
    createdByUserId: integer('created_by_user_id').notNull().references(() => users.id),
    ...timestamps,
  },
  (table) => [
    index('idx_inventory_transfers_origin_branch_id').on(table.originBranchId),
    index('idx_inventory_transfers_destination_branch_id').on(table.destinationBranchId),
    index('idx_inventory_transfers_created_by').on(table.createdByUserId),
    index('idx_inventory_transfers_status').on(table.status),
    index('idx_inventory_transfers_created_at').on(table.createdAt),
    check('chk_inventory_transfers_origin_destination_different', sql`${table.originBranchId} <> ${table.destinationBranchId}`),
  ],
);

export const inventoryTransferItems = pgTable(
  'inventory_transfer_items',
  {
    id: serial('id').primaryKey(),
    transferId: integer('transfer_id').notNull().references(() => inventoryTransfers.id),
    productId: integer('product_id').notNull().references(() => products.id),
    quantity: integer('quantity').notNull(),
  },
  (table) => [
    index('idx_inventory_transfer_items_transfer_id').on(table.transferId),
    index('idx_inventory_transfer_items_product_id').on(table.productId),
    check('chk_inventory_transfer_items_quantity_positive', sql`${table.quantity} > 0`),
  ],
);

export const sales = pgTable(
  'sales',
  {
    id: serial('id').primaryKey(),
    saleNumber: varchar('sale_number', { length: 20 }).notNull().unique(),
    customerId: integer('customer_id').references(() => customers.id),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
    discount: numeric('discount', { precision: 12, scale: 2 }).notNull().default('0'),
    total: numeric('total', { precision: 12, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    reference: varchar('reference', { length: 120 }),
    note: text('note'),
    createdByUserId: integer('created_by_user_id').notNull().references(() => users.id),
    ...timestamps,
  },
  (table) => [
    index('idx_sales_sale_number').on(table.saleNumber),
    index('idx_sales_customer_id').on(table.customerId),
    index('idx_sales_branch_id').on(table.branchId),
    index('idx_sales_created_by').on(table.createdByUserId),
    index('idx_sales_created_at').on(table.createdAt),
    check('chk_sales_subtotal_non_negative', sql`${table.subtotal} >= 0`),
    check('chk_sales_discount_non_negative', sql`${table.discount} >= 0`),
    check('chk_sales_total_non_negative', sql`${table.total} >= 0`),
  ],
);

export const saleItems = pgTable(
  'sale_items',
  {
    id: serial('id').primaryKey(),
    saleId: integer('sale_id').notNull().references(() => sales.id),
    productId: integer('product_id').notNull().references(() => products.id),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [
    index('idx_sale_items_sale_id').on(table.saleId),
    index('idx_sale_items_product_id').on(table.productId),
    check('chk_sale_items_quantity_positive', sql`${table.quantity} > 0`),
    check('chk_sale_items_unit_price_non_negative', sql`${table.unitPrice} >= 0`),
    check('chk_sale_items_subtotal_non_negative', sql`${table.subtotal} >= 0`),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id),
    branchId: integer('branch_id').references(() => branches.id),
    action: varchar('action', { length: 120 }).notNull(),
    entity: varchar('entity', { length: 120 }).notNull(),
    entityId: varchar('entity_id', { length: 80 }),
    description: text('description').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_audit_logs_user_id').on(table.userId),
    index('idx_audit_logs_branch_id').on(table.branchId),
    index('idx_audit_logs_entity').on(table.entity),
    index('idx_audit_logs_entity_id').on(table.entityId),
    index('idx_audit_logs_action').on(table.action),
    index('idx_audit_logs_created_at').on(table.createdAt),
  ],
);

export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 120 }).notNull().unique(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
}));

export const branchesRelations = relations(branches, ({ many }) => ({
  users: many(users),
  devices: many(devices),
  deviceStatusHistory: many(deviceStatusHistory),
  devicePayments: many(devicePayments),
  inventories: many(inventories),
  inventoryMovements: many(inventoryMovements),
  originTransfers: many(inventoryTransfers, { relationName: 'origin_branch' }),
  destinationTransfers: many(inventoryTransfers, { relationName: 'destination_branch' }),
  sales: many(sales),
  auditLogs: many(auditLogs),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
  branch: one(branches, { fields: [users.branchId], references: [branches.id] }),
  assignedDevices: many(devices),
  statusChanges: many(deviceStatusHistory),
  devicePayments: many(devicePayments),
  inventoryMovements: many(inventoryMovements),
  inventoryTransfers: many(inventoryTransfers),
  sales: many(sales),
  auditLogs: many(auditLogs),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  devices: many(devices),
  sales: many(sales),
}));

export const deviceTypesRelations = relations(deviceTypes, ({ many }) => ({
  devices: many(devices),
}));

export const devicesRelations = relations(devices, ({ one, many }) => ({
  customer: one(customers, { fields: [devices.customerId], references: [customers.id] }),
  branch: one(branches, { fields: [devices.branchId], references: [branches.id] }),
  technician: one(users, { fields: [devices.technicianId], references: [users.id] }),
  deviceType: one(deviceTypes, { fields: [devices.deviceTypeId], references: [deviceTypes.id] }),
  statusHistory: many(deviceStatusHistory),
  payments: many(devicePayments),
}));

export const deviceStatusHistoryRelations = relations(deviceStatusHistory, ({ one }) => ({
  device: one(devices, { fields: [deviceStatusHistory.deviceId], references: [devices.id] }),
  changedBy: one(users, { fields: [deviceStatusHistory.changedByUserId], references: [users.id] }),
  branch: one(branches, { fields: [deviceStatusHistory.branchId], references: [branches.id] }),
}));

export const devicePaymentsRelations = relations(devicePayments, ({ one }) => ({
  device: one(devices, { fields: [devicePayments.deviceId], references: [devices.id] }),
  createdBy: one(users, { fields: [devicePayments.createdByUserId], references: [users.id] }),
  branch: one(branches, { fields: [devicePayments.branchId], references: [branches.id] }),
}));

export const productCategoriesRelations = relations(productCategories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(productCategories, { fields: [products.categoryId], references: [productCategories.id] }),
  inventories: many(inventories),
  inventoryMovements: many(inventoryMovements),
  transferItems: many(inventoryTransferItems),
  saleItems: many(saleItems),
}));

export const inventoriesRelations = relations(inventories, ({ one }) => ({
  product: one(products, { fields: [inventories.productId], references: [products.id] }),
  branch: one(branches, { fields: [inventories.branchId], references: [branches.id] }),
}));

export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
  product: one(products, { fields: [inventoryMovements.productId], references: [products.id] }),
  branch: one(branches, { fields: [inventoryMovements.branchId], references: [branches.id] }),
  createdBy: one(users, { fields: [inventoryMovements.createdByUserId], references: [users.id] }),
}));

export const inventoryTransfersRelations = relations(inventoryTransfers, ({ one, many }) => ({
  originBranch: one(branches, {
    fields: [inventoryTransfers.originBranchId],
    references: [branches.id],
    relationName: 'origin_branch',
  }),
  destinationBranch: one(branches, {
    fields: [inventoryTransfers.destinationBranchId],
    references: [branches.id],
    relationName: 'destination_branch',
  }),
  createdBy: one(users, { fields: [inventoryTransfers.createdByUserId], references: [users.id] }),
  items: many(inventoryTransferItems),
}));

export const inventoryTransferItemsRelations = relations(inventoryTransferItems, ({ one }) => ({
  transfer: one(inventoryTransfers, { fields: [inventoryTransferItems.transferId], references: [inventoryTransfers.id] }),
  product: one(products, { fields: [inventoryTransferItems.productId], references: [products.id] }),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  customer: one(customers, { fields: [sales.customerId], references: [customers.id] }),
  branch: one(branches, { fields: [sales.branchId], references: [branches.id] }),
  createdBy: one(users, { fields: [sales.createdByUserId], references: [users.id] }),
  items: many(saleItems),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
  product: one(products, { fields: [saleItems.productId], references: [products.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
  branch: one(branches, { fields: [auditLogs.branchId], references: [branches.id] }),
}));
