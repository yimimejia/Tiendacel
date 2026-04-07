CREATE TYPE "public"."customer_visible_status_enum" AS ENUM('Pendiente', 'En reparación', 'Listo', 'Entregado');--> statement-breakpoint
CREATE TYPE "public"."internal_device_status_enum" AS ENUM('Recibido', 'Pendiente', 'En diagnóstico', 'Esperando aprobación', 'En reparación', 'Reparado', 'Listo para entregar', 'Entregado', 'Cancelado', 'No reparable');--> statement-breakpoint
CREATE TYPE "public"."inventory_movement_type_enum" AS ENUM('entrada', 'salida', 'ajuste', 'transferencia_salida', 'transferencia_entrada', 'venta');--> statement-breakpoint
CREATE TYPE "public"."inventory_transfer_status_enum" AS ENUM('creada', 'en_transito', 'completada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."payment_method_enum" AS ENUM('efectivo', 'transferencia', 'tarjeta', 'otro');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"branch_id" integer,
	"action" varchar(120) NOT NULL,
	"entity" varchar(120) NOT NULL,
	"entity_id" varchar(80),
	"description" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(140) NOT NULL,
	"code" varchar(25) NOT NULL,
	"address" text NOT NULL,
	"phone" varchar(30) NOT NULL,
	"manager_name" varchar(140),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "branches_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" varchar(180) NOT NULL,
	"phone" varchar(30) NOT NULL,
	"national_id" varchar(40),
	"address" text,
	"email" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "uniq_customers_full_name_phone" UNIQUE("full_name","phone")
);
--> statement-breakpoint
CREATE TABLE "device_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" "payment_method_enum" NOT NULL,
	"reference" varchar(120),
	"note" text,
	"created_by_user_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_device_payments_amount_positive" CHECK ("device_payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "device_status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"previous_status" "internal_device_status_enum",
	"new_status" "internal_device_status_enum" NOT NULL,
	"internal_note" text,
	"visible_to_customer" boolean DEFAULT false NOT NULL,
	"changed_by_user_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_number" varchar(20) NOT NULL,
	"device_sequence_number" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"technician_id" integer,
	"device_type_id" integer NOT NULL,
	"brand" varchar(80) NOT NULL,
	"model" varchar(120) NOT NULL,
	"color" varchar(40),
	"imei_or_serial" varchar(120),
	"pin_pattern_password" varchar(120),
	"storage_capacity" varchar(80),
	"battery_info" varchar(80),
	"accessories_received" jsonb,
	"physical_observations" text,
	"reported_issue" text NOT NULL,
	"initial_diagnosis" text,
	"internal_observations" text,
	"internal_status" "internal_device_status_enum" NOT NULL,
	"customer_visible_status" "customer_visible_status_enum" NOT NULL,
	"repair_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"initial_payment" numeric(12, 2) DEFAULT '0' NOT NULL,
	"pending_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"priority" varchar(30),
	"received_at" timestamp with time zone NOT NULL,
	"estimated_delivery_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"customer_visible_note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "devices_device_number_unique" UNIQUE("device_number"),
	CONSTRAINT "devices_device_sequence_number_unique" UNIQUE("device_sequence_number"),
	CONSTRAINT "chk_devices_repair_total_non_negative" CHECK ("devices"."repair_total" >= 0),
	CONSTRAINT "chk_devices_initial_payment_non_negative" CHECK ("devices"."initial_payment" >= 0),
	CONSTRAINT "chk_devices_pending_balance_non_negative" CHECK ("devices"."pending_balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventories" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"current_stock" integer DEFAULT 0 NOT NULL,
	"minimum_stock" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uniq_inventories_product_branch" UNIQUE("product_id","branch_id"),
	CONSTRAINT "chk_inventories_current_stock_non_negative" CHECK ("inventories"."current_stock" >= 0),
	CONSTRAINT "chk_inventories_minimum_stock_non_negative" CHECK ("inventories"."minimum_stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"movement_type" "inventory_movement_type_enum" NOT NULL,
	"quantity" integer NOT NULL,
	"previous_stock" integer NOT NULL,
	"new_stock" integer NOT NULL,
	"reference_type" varchar(60),
	"reference_id" integer,
	"note" text,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_inventory_movements_quantity_positive" CHECK ("inventory_movements"."quantity" > 0),
	CONSTRAINT "chk_inventory_movements_previous_stock_non_negative" CHECK ("inventory_movements"."previous_stock" >= 0),
	CONSTRAINT "chk_inventory_movements_new_stock_non_negative" CHECK ("inventory_movements"."new_stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_transfer_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "chk_inventory_transfer_items_quantity_positive" CHECK ("inventory_transfer_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"origin_branch_id" integer NOT NULL,
	"destination_branch_id" integer NOT NULL,
	"status" "inventory_transfer_status_enum" DEFAULT 'creada' NOT NULL,
	"note" text,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_inventory_transfers_origin_destination_different" CHECK ("inventory_transfers"."origin_branch_id" <> "inventory_transfers"."destination_branch_id")
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"sku" varchar(80),
	"category_id" integer NOT NULL,
	"brand" varchar(100),
	"model" varchar(120),
	"description" text,
	"cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sale_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_products_cost_non_negative" CHECK ("products"."cost" >= 0),
	CONSTRAINT "chk_products_sale_price_non_negative" CHECK ("products"."sale_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	CONSTRAINT "chk_sale_items_quantity_positive" CHECK ("sale_items"."quantity" > 0),
	CONSTRAINT "chk_sale_items_unit_price_non_negative" CHECK ("sale_items"."unit_price" >= 0),
	CONSTRAINT "chk_sale_items_subtotal_non_negative" CHECK ("sale_items"."subtotal" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_number" varchar(20) NOT NULL,
	"customer_id" integer,
	"branch_id" integer NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"payment_method" "payment_method_enum" NOT NULL,
	"reference" varchar(120),
	"note" text,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_sale_number_unique" UNIQUE("sale_number"),
	CONSTRAINT "chk_sales_subtotal_non_negative" CHECK ("sales"."subtotal" >= 0),
	CONSTRAINT "chk_sales_discount_non_negative" CHECK ("sales"."discount" >= 0),
	CONSTRAINT "chk_sales_total_non_negative" CHECK ("sales"."total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(120) NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"username_or_email" varchar(140) NOT NULL,
	"password_hash" text NOT NULL,
	"role_id" integer NOT NULL,
	"branch_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_username_or_email_unique" UNIQUE("username_or_email")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_payments" ADD CONSTRAINT "device_payments_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_payments" ADD CONSTRAINT "device_payments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_payments" ADD CONSTRAINT "device_payments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_status_history" ADD CONSTRAINT "device_status_history_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_status_history" ADD CONSTRAINT "device_status_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_status_history" ADD CONSTRAINT "device_status_history_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_device_type_id_device_types_id_fk" FOREIGN KEY ("device_type_id") REFERENCES "public"."device_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_items" ADD CONSTRAINT "inventory_transfer_items_transfer_id_inventory_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."inventory_transfers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_items" ADD CONSTRAINT "inventory_transfer_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_origin_branch_id_branches_id_fk" FOREIGN KEY ("origin_branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_destination_branch_id_branches_id_fk" FOREIGN KEY ("destination_branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_branch_id" ON "audit_logs" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" USING btree ("entity");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity_id" ON "audit_logs" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_branches_code" ON "branches" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_branches_is_active" ON "branches" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_customers_full_name" ON "customers" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "idx_customers_phone" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "idx_customers_national_id" ON "customers" USING btree ("national_id");--> statement-breakpoint
CREATE INDEX "idx_device_payments_device_id" ON "device_payments" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "idx_device_payments_created_by" ON "device_payments" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_device_payments_branch_id" ON "device_payments" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_device_payments_created_at" ON "device_payments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_device_status_history_device_id" ON "device_status_history" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "idx_device_status_history_changed_by" ON "device_status_history" USING btree ("changed_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_device_status_history_branch_id" ON "device_status_history" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_device_status_history_created_at" ON "device_status_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_devices_device_number" ON "devices" USING btree ("device_number");--> statement-breakpoint
CREATE INDEX "idx_devices_device_sequence_number" ON "devices" USING btree ("device_sequence_number");--> statement-breakpoint
CREATE INDEX "idx_devices_customer_id" ON "devices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_devices_branch_id" ON "devices" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_devices_technician_id" ON "devices" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "idx_devices_device_type_id" ON "devices" USING btree ("device_type_id");--> statement-breakpoint
CREATE INDEX "idx_devices_imei_or_serial" ON "devices" USING btree ("imei_or_serial");--> statement-breakpoint
CREATE INDEX "idx_devices_internal_status" ON "devices" USING btree ("internal_status");--> statement-breakpoint
CREATE INDEX "idx_devices_customer_visible_status" ON "devices" USING btree ("customer_visible_status");--> statement-breakpoint
CREATE INDEX "idx_devices_received_at" ON "devices" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_devices_created_at" ON "devices" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_inventories_product_id" ON "inventories" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_inventories_branch_id" ON "inventories" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_inventories_current_stock" ON "inventories" USING btree ("current_stock");--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_product_id" ON "inventory_movements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_branch_id" ON "inventory_movements" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_movement_type" ON "inventory_movements" USING btree ("movement_type");--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_created_by" ON "inventory_movements" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_created_at" ON "inventory_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_reference_type" ON "inventory_movements" USING btree ("reference_type");--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_reference_id" ON "inventory_movements" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_transfer_items_transfer_id" ON "inventory_transfer_items" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_transfer_items_product_id" ON "inventory_transfer_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_transfers_origin_branch_id" ON "inventory_transfers" USING btree ("origin_branch_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_transfers_destination_branch_id" ON "inventory_transfers" USING btree ("destination_branch_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_transfers_created_by" ON "inventory_transfers" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_transfers_status" ON "inventory_transfers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_inventory_transfers_created_at" ON "inventory_transfers" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_products_sku" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_products_category_id" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_products_brand" ON "products" USING btree ("brand");--> statement-breakpoint
CREATE INDEX "idx_products_name" ON "products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_products_is_active" ON "products" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_sale_items_sale_id" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "idx_sale_items_product_id" ON "sale_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_sales_sale_number" ON "sales" USING btree ("sale_number");--> statement-breakpoint
CREATE INDEX "idx_sales_customer_id" ON "sales" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_sales_branch_id" ON "sales" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_sales_created_by" ON "sales" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_sales_created_at" ON "sales" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_users_username_or_email" ON "users" USING btree ("username_or_email");--> statement-breakpoint
CREATE INDEX "idx_users_role_id" ON "users" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_users_branch_id" ON "users" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_users_is_active" ON "users" USING btree ("is_active");