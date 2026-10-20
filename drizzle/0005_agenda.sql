CREATE TYPE "public"."attendance_method" AS ENUM('manual', 'scan', 'delegasi', 'search', 'self', 'otomatis');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('hadir', 'terlambat', 'izin', 'sakit', 'alpa');--> statement-breakpoint
CREATE TABLE "agendas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"unit_path" "ltree" DEFAULT ''::ltree NOT NULL,
	"title" text NOT NULL,
	"location" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"late_after" timestamp with time zone NOT NULL,
	"target_jenjang_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"target_kategori_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"target_gender" "gender",
	"recurrence_id" uuid,
	"delegate_until" timestamp with time zone NOT NULL,
	"locked_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agenda_id" uuid NOT NULL,
	"generus_id" uuid NOT NULL,
	"status" "attendance_status" NOT NULL,
	"method" "attendance_method" DEFAULT 'manual' NOT NULL,
	"note" text,
	"recorded_by" uuid,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_agenda_generus_unique" UNIQUE("agenda_id","generus_id")
);
--> statement-breakpoint
ALTER TABLE "agendas" ADD CONSTRAINT "agendas_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_agenda_id_agendas_id_fk" FOREIGN KEY ("agenda_id") REFERENCES "public"."agendas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_generus_id_generus_id_fk" FOREIGN KEY ("generus_id") REFERENCES "public"."generus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agendas_unit_path_gist" ON "agendas" USING gist ("unit_path");--> statement-breakpoint
CREATE INDEX "agendas_starts_at_idx" ON "agendas" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "agendas_recurrence_idx" ON "agendas" USING btree ("recurrence_id");--> statement-breakpoint
CREATE INDEX "attendance_generus_idx" ON "attendance" USING btree ("generus_id");