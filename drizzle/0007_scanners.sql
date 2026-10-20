CREATE TABLE "agenda_scanners" (
	"agenda_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agenda_scanners_agenda_id_user_id_pk" PRIMARY KEY("agenda_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "agenda_scanners" ADD CONSTRAINT "agenda_scanners_agenda_id_agendas_id_fk" FOREIGN KEY ("agenda_id") REFERENCES "public"."agendas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_scanners" ADD CONSTRAINT "agenda_scanners_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agenda_scanners_user_idx" ON "agenda_scanners" USING btree ("user_id");