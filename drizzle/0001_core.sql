CREATE TYPE "public"."app_role" AS ENUM('superadmin', 'kurikulum', 'admin', 'kyai');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('L', 'P');--> statement-breakpoint
CREATE TYPE "public"."generus_status" AS ENUM('aktif', 'pindah_sambung', 'menikah');--> statement-breakpoint
CREATE TYPE "public"."unit_level" AS ENUM('daerah', 'desa', 'kelompok');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"table_name" text NOT NULL,
	"row_id" uuid,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kelompok_id" uuid NOT NULL,
	"unit_path" "ltree" DEFAULT ''::ltree NOT NULL,
	"name" text NOT NULL,
	"gender" "gender" NOT NULL,
	"birth_date" date NOT NULL,
	"jenjang_id" uuid NOT NULL,
	"kategori_id" uuid,
	"school" text,
	"guardian_name" text,
	"guardian_phone" text,
	"notes" text,
	"qr_token" text DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)) NOT NULL,
	"qr_active" boolean DEFAULT true NOT NULL,
	"status" "generus_status" DEFAULT 'aktif' NOT NULL,
	"status_date" date,
	"status_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generus_qr_token_unique" UNIQUE("qr_token")
);
--> statement-breakpoint
CREATE TABLE "generus_mutations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generus_id" uuid NOT NULL,
	"from_unit_id" uuid NOT NULL,
	"to_unit_id" uuid NOT NULL,
	"mutated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mutated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "generus_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generus_id" uuid NOT NULL,
	"from_status" "generus_status" NOT NULL,
	"to_status" "generus_status" NOT NULL,
	"status_date" date NOT NULL,
	"note" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changed_by" uuid
);
--> statement-breakpoint
CREATE TABLE "jenjang" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "jenjang_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "jenjang_kategori" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jenjang_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "jenjang_kategori_unique" UNIQUE("jenjang_id","name")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"level" "unit_level" NOT NULL,
	"name" text NOT NULL,
	"path" "ltree" DEFAULT ''::ltree NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_path_unique" UNIQUE("path"),
	CONSTRAINT "units_parent_name_unique" UNIQUE("parent_id","name")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"role" "app_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_unique" UNIQUE("user_id","unit_id","role")
);
--> statement-breakpoint
ALTER TABLE "generus" ADD CONSTRAINT "generus_kelompok_id_units_id_fk" FOREIGN KEY ("kelompok_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generus" ADD CONSTRAINT "generus_jenjang_id_jenjang_id_fk" FOREIGN KEY ("jenjang_id") REFERENCES "public"."jenjang"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generus" ADD CONSTRAINT "generus_kategori_id_jenjang_kategori_id_fk" FOREIGN KEY ("kategori_id") REFERENCES "public"."jenjang_kategori"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generus_mutations" ADD CONSTRAINT "generus_mutations_generus_id_generus_id_fk" FOREIGN KEY ("generus_id") REFERENCES "public"."generus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generus_mutations" ADD CONSTRAINT "generus_mutations_from_unit_id_units_id_fk" FOREIGN KEY ("from_unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generus_mutations" ADD CONSTRAINT "generus_mutations_to_unit_id_units_id_fk" FOREIGN KEY ("to_unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generus_status_history" ADD CONSTRAINT "generus_status_history_generus_id_generus_id_fk" FOREIGN KEY ("generus_id") REFERENCES "public"."generus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jenjang_kategori" ADD CONSTRAINT "jenjang_kategori_jenjang_id_jenjang_id_fk" FOREIGN KEY ("jenjang_id") REFERENCES "public"."jenjang"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_parent_id_units_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_row_idx" ON "audit_log" USING btree ("table_name","row_id");--> statement-breakpoint
CREATE INDEX "generus_unit_path_gist" ON "generus" USING gist ("unit_path");--> statement-breakpoint
CREATE INDEX "generus_kelompok_idx" ON "generus" USING btree ("kelompok_id");--> statement-breakpoint
CREATE INDEX "units_path_gist" ON "units" USING gist ("path");--> statement-breakpoint
CREATE INDEX "user_roles_user_idx" ON "user_roles" USING btree ("user_id");