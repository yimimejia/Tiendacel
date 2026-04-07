import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  auditLogs,
  branches,
  customers,
  devicePayments,
  deviceStatusHistory,
  deviceTypes,
  devices,
  inventories,
  inventoryMovements,
  inventoryTransferItems,
  inventoryTransfers,
  productCategories,
  products,
  roles,
  saleItems,
  sales,
  settings,
  users,
} from './schema.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL es requerida para ejecutar el seed.');
}

const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle(pool);

async function upsertRole(name: string, description: string) {
  const [existing] = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(roles).values({ name, description }).returning();
  return created;
}

async function runSeed() {
  const passwordHash = await bcrypt.hash('VibranTech2026*', 10);

  const adminRole = await upsertRole('administrador_general', 'Administrador con acceso global.');
  const managerRole = await upsertRole('encargado_sucursal', 'Encargado de una sucursal.');
  const technicianRole = await upsertRole('tecnico', 'Técnico de reparaciones.');
  const cashierRole = await upsertRole('caja_ventas', 'Caja y ventas.');

  const [mainBranch] = await db
    .insert(branches)
    .values({
      name: 'Sucursal Principal',
      code: 'PRI-001',
      address: 'Av. Central 123',
      phone: '+1-305-555-0101',
      managerName: 'Carla Mendoza',
    })
    .onConflictDoNothing({ target: branches.code })
    .returning();

  const [northBranch] = await db
    .insert(branches)
    .values({
      name: 'Sucursal Norte',
      code: 'NOR-002',
      address: 'Calle Norte 45',
      phone: '+1-305-555-0102',
      managerName: 'Andrés Soto',
    })
    .onConflictDoNothing({ target: branches.code })
    .returning();

  const [main] = mainBranch
    ? [mainBranch]
    : await db.select().from(branches).where(eq(branches.code, 'PRI-001')).limit(1);

  const [north] = northBranch
    ? [northBranch]
    : await db.select().from(branches).where(eq(branches.code, 'NOR-002')).limit(1);

  const adminUser = await db
    .insert(users)
    .values({
      fullName: 'Admin General',
      usernameOrEmail: 'admin@vibran.tech',
      passwordHash,
      roleId: adminRole.id,
      branchId: null,
      isActive: true,
    })
    .onConflictDoNothing({ target: users.usernameOrEmail })
    .returning();

  const seededUsers = [
    {
      fullName: 'Encargado Principal',
      usernameOrEmail: 'encargado.principal@vibran.tech',
      roleId: managerRole.id,
      branchId: main.id,
    },
    {
      fullName: 'Encargado Norte',
      usernameOrEmail: 'encargado.norte@vibran.tech',
      roleId: managerRole.id,
      branchId: north.id,
    },
    {
      fullName: 'Técnico Uno',
      usernameOrEmail: 'tecnico@vibran.tech',
      roleId: technicianRole.id,
      branchId: main.id,
    },
    {
      fullName: 'Caja Uno',
      usernameOrEmail: 'caja@vibran.tech',
      roleId: cashierRole.id,
      branchId: main.id,
    },
  ];

  for (const user of seededUsers) {
    await db
      .insert(users)
      .values({ ...user, passwordHash, isActive: true })
      .onConflictDoNothing({ target: users.usernameOrEmail });
  }

  const [techUser] = await db.select().from(users).where(eq(users.usernameOrEmail, 'tecnico@vibran.tech')).limit(1);
  const [cashierUser] = await db.select().from(users).where(eq(users.usernameOrEmail, 'caja@vibran.tech')).limit(1);
  const [admin] = adminUser.length
    ? adminUser
    : await db.select().from(users).where(eq(users.usernameOrEmail, 'admin@vibran.tech')).limit(1);

  for (const typeName of ['Celular', 'Tablet', 'Laptop', 'Smartwatch', 'Otro']) {
    await db.insert(deviceTypes).values({ name: typeName }).onConflictDoNothing({ target: deviceTypes.name });
  }

  for (const categoryName of ['Celulares', 'Cargadores', 'Cables', 'Protectores', 'Audífonos', 'Memorias', 'Accesorios', 'Otros']) {
    await db.insert(productCategories).values({ name: categoryName }).onConflictDoNothing({ target: productCategories.name });
  }

  const seededCustomers = [
    { fullName: 'Carlos Mejía', phone: '+1-305-555-0120', email: 'carlos@correo.com' },
    { fullName: 'Laura Ruiz', phone: '+1-305-555-0121', email: 'laura@correo.com' },
    { fullName: 'Miguel Torres', phone: '+1-305-555-0122', email: 'miguel@correo.com' },
  ];

  for (const customer of seededCustomers) {
    await db
      .insert(customers)
      .values(customer)
      .onConflictDoNothing({ target: [customers.fullName, customers.phone] as never });
  }

  const allCustomers = await db.select().from(customers);
  const allDeviceTypes = await db.select().from(deviceTypes);
  const allCategories = await db.select().from(productCategories);

  const categoriaAccesorios = allCategories.find((category) => category.name === 'Accesorios')!;
  const categoriaCargadores = allCategories.find((category) => category.name === 'Cargadores')!;

  const seededProducts = [
    {
      name: 'Cargador USB-C 25W',
      sku: 'CAR-USB-C-25W',
      categoryId: categoriaCargadores.id,
      brand: 'Vibran',
      model: 'VC25',
      cost: '8.50',
      salePrice: '18.00',
    },
    {
      name: 'Cable USB-C reforzado',
      sku: 'CAB-USBC-RF',
      categoryId: categoriaAccesorios.id,
      brand: 'Vibran',
      model: 'CBL-R1',
      cost: '3.00',
      salePrice: '9.50',
    },
  ];

  for (const product of seededProducts) {
    await db.insert(products).values(product).onConflictDoNothing({ target: products.sku });
  }

  const allProducts = await db.select().from(products);
  for (const product of allProducts) {
    await db
      .insert(inventories)
      .values([
        { productId: product.id, branchId: main.id, currentStock: 20, minimumStock: 5 },
        { productId: product.id, branchId: north.id, currentStock: 12, minimumStock: 4 },
      ])
      .onConflictDoNothing({ target: [inventories.productId, inventories.branchId] });
  }

  const celularType = allDeviceTypes.find((type) => type.name === 'Celular')!;

  const deviceSeedData = [
    {
      deviceNumber: 'REP-000001',
      deviceSequenceNumber: 1,
      customerId: allCustomers[0].id,
      branchId: main.id,
      technicianId: techUser.id,
      deviceTypeId: celularType.id,
      brand: 'Apple',
      model: 'iPhone 13',
      reportedIssue: 'Pantalla partida',
      internalStatus: 'En reparación' as const,
      customerVisibleStatus: 'En reparación' as const,
      repairTotal: '180.00',
      initialPayment: '60.00',
      pendingBalance: '120.00',
      receivedAt: new Date('2026-04-01T10:00:00Z'),
      customerVisibleNote: 'Esperando prueba final',
    },
    {
      deviceNumber: 'REP-000002',
      deviceSequenceNumber: 2,
      customerId: allCustomers[1].id,
      branchId: north.id,
      technicianId: techUser.id,
      deviceTypeId: celularType.id,
      brand: 'Samsung',
      model: 'A54',
      reportedIssue: 'No carga',
      internalStatus: 'Pendiente' as const,
      customerVisibleStatus: 'Pendiente' as const,
      repairTotal: '95.00',
      initialPayment: '20.00',
      pendingBalance: '75.00',
      receivedAt: new Date('2026-04-02T14:30:00Z'),
      customerVisibleNote: 'Pendiente ingreso de repuesto',
    },
  ];

  for (const deviceData of deviceSeedData) {
    await db.insert(devices).values(deviceData).onConflictDoNothing({ target: devices.deviceNumber });
  }

  const seededDevices = await db.select().from(devices);

  for (const device of seededDevices) {
    await db.insert(deviceStatusHistory).values({
      deviceId: device.id,
      previousStatus: null,
      newStatus: 'Recibido',
      internalNote: 'Ingreso inicial de equipo',
      visibleToCustomer: true,
      changedByUserId: admin.id,
      branchId: device.branchId,
    });
  }

  const firstDevice = seededDevices.find((device) => device.deviceNumber === 'REP-000001');
  const secondDevice = seededDevices.find((device) => device.deviceNumber === 'REP-000002');

  if (firstDevice) {
    await db
      .insert(devicePayments)
      .values({
        deviceId: firstDevice.id,
        amount: '60.00',
        paymentMethod: 'efectivo',
        note: 'Abono inicial',
        createdByUserId: cashierUser.id,
        branchId: firstDevice.branchId,
      })
      .onConflictDoNothing();
  }

  if (secondDevice) {
    await db
      .insert(devicePayments)
      .values({
        deviceId: secondDevice.id,
        amount: '20.00',
        paymentMethod: 'tarjeta',
        note: 'Abono inicial',
        createdByUserId: cashierUser.id,
        branchId: secondDevice.branchId,
      })
      .onConflictDoNothing();
  }

  const [saleOne] = await db
    .insert(sales)
    .values({
      saleNumber: 'VTA-000001',
      customerId: allCustomers[0].id,
      branchId: main.id,
      subtotal: '27.50',
      discount: '0.00',
      total: '27.50',
      paymentMethod: 'tarjeta',
      createdByUserId: cashierUser.id,
      note: 'Venta seed principal',
    })
    .onConflictDoNothing({ target: sales.saleNumber })
    .returning();

  const existingSale = saleOne
    ? saleOne
    : (await db.select().from(sales).where(eq(sales.saleNumber, 'VTA-000001')).limit(1))[0];

  const firstProduct = allProducts[0];

  const existingItem = await db
    .select()
    .from(saleItems)
    .where(and(eq(saleItems.saleId, existingSale.id), eq(saleItems.productId, firstProduct.id)))
    .limit(1);

  if (existingItem.length === 0) {
    await db.insert(saleItems).values({
      saleId: existingSale.id,
      productId: firstProduct.id,
      quantity: 1,
      unitPrice: '18.00',
      subtotal: '18.00',
    });
  }

  const [transfer] = await db
    .insert(inventoryTransfers)
    .values({
      originBranchId: main.id,
      destinationBranchId: north.id,
      status: 'completada',
      note: 'Reposición inicial',
      createdByUserId: admin.id,
    })
    .returning();

  if (transfer) {
    await db.insert(inventoryTransferItems).values({ transferId: transfer.id, productId: firstProduct.id, quantity: 2 });
  }

  await db.insert(settings).values([
    { key: 'negocio_nombre', value: 'Vibran Tech', description: 'Nombre comercial visible' },
    { key: 'formato_numero_reparacion', value: 'REP-{000000}', description: 'Plantilla para números de reparación' },
    { key: 'formato_numero_venta', value: 'VTA-{000000}', description: 'Plantilla para números de venta' },
  ]).onConflictDoNothing({ target: settings.key });

  await db.insert(auditLogs).values({
    userId: admin.id,
    branchId: null,
    action: 'seed_inicial',
    entity: 'sistema',
    entityId: null,
    description: 'Carga inicial de datos de prueba.',
    metadata: { executedAt: new Date().toISOString() },
  });

  const existingSeedMovement = await db
    .select()
    .from(inventoryMovements)
    .where(and(eq(inventoryMovements.referenceType, 'seed'), eq(inventoryMovements.productId, firstProduct.id)))
    .limit(1);

  if (existingSeedMovement.length === 0) {
    await db.insert(inventoryMovements).values({
      productId: firstProduct.id,
      branchId: main.id,
      movementType: 'entrada',
      quantity: 20,
      previousStock: 0,
      newStock: 20,
      referenceType: 'seed',
      referenceId: null,
      note: 'Carga inicial de inventario',
      createdByUserId: admin.id,
    });
  }
}

runSeed()
  .then(() => {
    console.log('Seed ejecutado correctamente.');
  })
  .catch((error) => {
    console.error('Error ejecutando seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
