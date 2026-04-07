ALTER TABLE "customers" ADD COLUMN "branch_id" integer;
UPDATE "customers"
SET "branch_id" = COALESCE(
  (
    SELECT d.branch_id
    FROM "devices" d
    WHERE d.customer_id = customers.id
    ORDER BY d.id ASC
    LIMIT 1
  ),
  (SELECT id FROM "branches" ORDER BY id ASC LIMIT 1)
);
ALTER TABLE "customers" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "customers" ADD CONSTRAINT "customers_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "idx_customers_branch_id" ON "customers" USING btree ("branch_id");
ALTER TABLE "customers" DROP CONSTRAINT "uniq_customers_full_name_phone";
ALTER TABLE "customers" ADD CONSTRAINT "uniq_customers_branch_full_name_phone" UNIQUE("branch_id","full_name","phone");

CREATE TYPE "public"."fiscal_range_status_enum" AS ENUM('activo', 'agotado', 'vencido', 'inactivo');
CREATE TYPE "public"."invoice_status_enum" AS ENUM('emitida', 'anulada');

CREATE TABLE "branch_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "branch_id" integer NOT NULL,
  "business_name" varchar(180),
  "logo_url" text,
  "address" text,
  "phone" varchar(30),
  "email" varchar(160),
  "rnc" varchar(40),
  "fiscal_name" varchar(180),
  "receipt_footer" text,
  "invoice_footer" text,
  "warranty_days_default" integer DEFAULT 30 NOT NULL,
  "block_delivery_with_balance" boolean DEFAULT false NOT NULL,
  "feature_flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "branch_settings_branch_id_unique" UNIQUE("branch_id")
);
ALTER TABLE "branch_settings" ADD CONSTRAINT "branch_settings_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "idx_branch_settings_branch_id" ON "branch_settings" USING btree ("branch_id");

CREATE TABLE "fiscal_voucher_types" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(120) NOT NULL,
  "code" varchar(40) NOT NULL,
  "description" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fiscal_voucher_types_code_unique" UNIQUE("code")
);

CREATE TABLE "branch_fiscal_voucher_types" (
  "id" serial PRIMARY KEY NOT NULL,
  "branch_id" integer NOT NULL,
  "voucher_type_id" integer NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "prefix" varchar(20),
  "series" varchar(20),
  "current_internal_sequence" integer DEFAULT 0 NOT NULL,
  "invoice_prefix" varchar(20),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "uniq_branch_voucher_type" UNIQUE("branch_id","voucher_type_id")
);
ALTER TABLE "branch_fiscal_voucher_types" ADD CONSTRAINT "branch_fiscal_voucher_types_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "branch_fiscal_voucher_types" ADD CONSTRAINT "branch_fiscal_voucher_types_voucher_type_id_fiscal_voucher_types_id_fk" FOREIGN KEY ("voucher_type_id") REFERENCES "public"."fiscal_voucher_types"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "idx_branch_voucher_branch_id" ON "branch_fiscal_voucher_types" USING btree ("branch_id");

CREATE TABLE "fiscal_ranges" (
  "id" serial PRIMARY KEY NOT NULL,
  "branch_id" integer NOT NULL,
  "voucher_type_id" integer NOT NULL,
  "range_start" integer NOT NULL,
  "range_end" integer NOT NULL,
  "next_number" integer NOT NULL,
  "total_available" integer NOT NULL,
  "total_used" integer DEFAULT 0 NOT NULL,
  "status" "fiscal_range_status_enum" DEFAULT 'activo' NOT NULL,
  "expires_at" date,
  "observations" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "fiscal_ranges" ADD CONSTRAINT "fiscal_ranges_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "fiscal_ranges" ADD CONSTRAINT "fiscal_ranges_voucher_type_id_fiscal_voucher_types_id_fk" FOREIGN KEY ("voucher_type_id") REFERENCES "public"."fiscal_voucher_types"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "idx_fiscal_ranges_branch_id" ON "fiscal_ranges" USING btree ("branch_id");
CREATE INDEX "idx_fiscal_ranges_voucher_type_id" ON "fiscal_ranges" USING btree ("voucher_type_id");

CREATE TABLE "invoices" (
  "id" serial PRIMARY KEY NOT NULL,
  "branch_id" integer NOT NULL,
  "customer_id" integer NOT NULL,
  "sale_id" integer,
  "invoice_number" varchar(80) NOT NULL,
  "voucher_type_id" integer NOT NULL,
  "fiscal_range_id" integer,
  "ncf_number" varchar(80),
  "subtotal" numeric(12, 2) NOT NULL,
  "tax_total" numeric(12, 2) DEFAULT '0' NOT NULL,
  "total" numeric(12, 2) NOT NULL,
  "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "issued_by_user_id" integer NOT NULL,
  "status" "invoice_status_enum" DEFAULT 'emitida' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "uniq_invoices_branch_invoice_number" UNIQUE("branch_id","invoice_number")
);
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_voucher_type_id_fiscal_voucher_types_id_fk" FOREIGN KEY ("voucher_type_id") REFERENCES "public"."fiscal_voucher_types"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_fiscal_range_id_fiscal_ranges_id_fk" FOREIGN KEY ("fiscal_range_id") REFERENCES "public"."fiscal_ranges"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issued_by_user_id_users_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "idx_invoices_branch_id" ON "invoices" USING btree ("branch_id");
CREATE INDEX "idx_invoices_customer_id" ON "invoices" USING btree ("customer_id");

CREATE TABLE "invoice_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "invoice_id" integer NOT NULL,
  "description" text NOT NULL,
  "qty" integer NOT NULL,
  "unit_price" numeric(12, 2) NOT NULL,
  "line_total" numeric(12, 2) NOT NULL
);
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "idx_invoice_items_invoice_id" ON "invoice_items" USING btree ("invoice_id");
