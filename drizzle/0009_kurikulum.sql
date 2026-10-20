CREATE TYPE "public"."achievement_status" AS ENUM('belum', 'proses', 'tuntas');--> statement-breakpoint
CREATE TYPE "public"."aspek" AS ENUM('alim', 'faqih', 'akhlaq', 'mandiri');--> statement-breakpoint
CREATE TYPE "public"."assessment_mode" AS ENUM('generus', 'kelompok');--> statement-breakpoint
CREATE TYPE "public"."kitab_unit" AS ENUM('ayat', 'halaman', 'bab');--> statement-breakpoint
CREATE TABLE "achievements" (
	"target_id" uuid NOT NULL,
	"generus_id" uuid NOT NULL,
	"status" "achievement_status" NOT NULL,
	"note" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "achievements_target_id_generus_id_pk" PRIMARY KEY("target_id","generus_id")
);
--> statement-breakpoint
CREATE TABLE "curriculum_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"semester" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "curriculum_periods_name_unique" UNIQUE("name"),
	CONSTRAINT "curriculum_periods_range" CHECK ("curriculum_periods"."ends_on" >= "curriculum_periods"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "kitab" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"unit" "kitab_unit" NOT NULL,
	"total" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kitab_title_unique" UNIQUE("title"),
	CONSTRAINT "kitab_total_positive" CHECK ("kitab"."total" > 0)
);
--> statement-breakpoint
CREATE TABLE "kitab_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generus_id" uuid NOT NULL,
	"kitab_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"recorded_on" date DEFAULT current_date NOT NULL,
	"note" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aspek" "aspek" NOT NULL,
	"mapel" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"arabic" text,
	"translation" text,
	"source" text,
	"assessment" "assessment_mode" DEFAULT 'generus' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "materi_unique" UNIQUE("aspek","mapel","title")
);
--> statement-breakpoint
CREATE TABLE "period_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"jenjang_id" uuid NOT NULL,
	"kategori_id" uuid,
	"gender" "gender",
	"sort_order" integer DEFAULT 0 NOT NULL,
	"aspek" "aspek" NOT NULL,
	"mapel" text NOT NULL,
	"materi_id" uuid,
	"kitab_id" uuid,
	"range_from" integer,
	"range_to" integer,
	"note" text,
	"strategy" text,
	"optional" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "period_targets_kind" CHECK (("period_targets"."materi_id" IS NOT NULL AND "period_targets"."kitab_id" IS NULL AND "period_targets"."range_from" IS NULL AND "period_targets"."range_to" IS NULL)
        OR ("period_targets"."materi_id" IS NULL AND "period_targets"."kitab_id" IS NOT NULL AND "period_targets"."range_from" >= 1 AND "period_targets"."range_to" >= "period_targets"."range_from"))
);
--> statement-breakpoint
CREATE TABLE "target_deliveries" (
	"target_id" uuid NOT NULL,
	"kelompok_id" uuid NOT NULL,
	"unit_path" "ltree" DEFAULT ''::ltree NOT NULL,
	"delivered_on" date NOT NULL,
	"note" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "target_deliveries_target_id_kelompok_id_pk" PRIMARY KEY("target_id","kelompok_id")
);
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_target_id_period_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."period_targets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_generus_id_generus_id_fk" FOREIGN KEY ("generus_id") REFERENCES "public"."generus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitab_progress" ADD CONSTRAINT "kitab_progress_generus_id_generus_id_fk" FOREIGN KEY ("generus_id") REFERENCES "public"."generus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitab_progress" ADD CONSTRAINT "kitab_progress_kitab_id_kitab_id_fk" FOREIGN KEY ("kitab_id") REFERENCES "public"."kitab"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_targets" ADD CONSTRAINT "period_targets_period_id_curriculum_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."curriculum_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_targets" ADD CONSTRAINT "period_targets_jenjang_id_jenjang_id_fk" FOREIGN KEY ("jenjang_id") REFERENCES "public"."jenjang"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_targets" ADD CONSTRAINT "period_targets_kategori_id_jenjang_kategori_id_fk" FOREIGN KEY ("kategori_id") REFERENCES "public"."jenjang_kategori"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_targets" ADD CONSTRAINT "period_targets_materi_id_materi_id_fk" FOREIGN KEY ("materi_id") REFERENCES "public"."materi"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_targets" ADD CONSTRAINT "period_targets_kitab_id_kitab_id_fk" FOREIGN KEY ("kitab_id") REFERENCES "public"."kitab"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_deliveries" ADD CONSTRAINT "target_deliveries_target_id_period_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."period_targets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_deliveries" ADD CONSTRAINT "target_deliveries_kelompok_id_units_id_fk" FOREIGN KEY ("kelompok_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "achievements_generus_idx" ON "achievements" USING btree ("generus_id");--> statement-breakpoint
CREATE INDEX "curriculum_periods_starts_idx" ON "curriculum_periods" USING btree ("starts_on");--> statement-breakpoint
CREATE INDEX "kitab_progress_latest_idx" ON "kitab_progress" USING btree ("generus_id","kitab_id","recorded_on","created_at");--> statement-breakpoint
CREATE INDEX "period_targets_period_idx" ON "period_targets" USING btree ("period_id","jenjang_id","sort_order");--> statement-breakpoint
CREATE INDEX "target_deliveries_unit_path_gist" ON "target_deliveries" USING gist ("unit_path");