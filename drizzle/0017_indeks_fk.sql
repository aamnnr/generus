CREATE INDEX "agendas_unit_idx" ON "agendas" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "generus_jenjang_idx" ON "generus" USING btree ("jenjang_id");--> statement-breakpoint
CREATE INDEX "generus_mutations_generus_idx" ON "generus_mutations" USING btree ("generus_id","mutated_at");--> statement-breakpoint
CREATE INDEX "generus_status_history_generus_idx" ON "generus_status_history" USING btree ("generus_id","changed_at");--> statement-breakpoint
CREATE INDEX "kitab_progress_kitab_idx" ON "kitab_progress" USING btree ("kitab_id");--> statement-breakpoint
CREATE INDEX "user_roles_unit_idx" ON "user_roles" USING btree ("unit_id");