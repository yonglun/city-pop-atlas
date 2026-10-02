import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const entities = sqliteTable('entities', {
 id:text('id').primaryKey(), type:text('type').notNull(), year:integer('year'), payload:text('payload').notNull(), updatedAt:text('updated_at').notNull()
},t=>[index('idx_entities_type_year').on(t.type,t.year)]);
export const relationships=sqliteTable('relationships',{
 id:text('id').primaryKey(),source:text('source').notNull().references(()=>entities.id),target:text('target').notNull().references(()=>entities.id),type:text('type').notNull(),payload:text('payload').notNull()
},t=>[index('idx_relationships_source').on(t.source),index('idx_relationships_target').on(t.target)]);
export const media=sqliteTable('media',{
 id:text('id').primaryKey(),entityId:text('entity_id').notNull().references(()=>entities.id),kind:text('kind').notNull(),payload:text('payload').notNull()
},t=>[index('idx_media_entity').on(t.entityId)]);
export const externalLinks=sqliteTable('external_links',{
 id:text('id').primaryKey(),entityId:text('entity_id').notNull().references(()=>entities.id),service:text('service').notNull(),payload:text('payload').notNull()
},t=>[index('idx_external_links_entity').on(t.entityId)]);
export const propertyDefinitions=sqliteTable('property_definitions',{key:text('key').primaryKey(),payload:text('payload').notNull()});
export const imports=sqliteTable('imports',{id:text('id').primaryKey(),importedAt:text('imported_at').notNull(),entityCount:integer('entity_count').notNull(),relationshipCount:integer('relationship_count').notNull()});

// Review data is separate from seed-owned tables and survives catalog refreshes.
export const candidates=sqliteTable('candidates',{
 id:text('id').primaryKey(),entityId:text('entity_id').notNull(),field:text('field').notNull(),payload:text('payload').notNull(),baseValue:text('base_value').notNull(),status:text('status').notNull().default('pending'),version:integer('version').notNull().default(1),decisionId:text('decision_id'),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
},t=>[index('idx_candidates_status').on(t.status),index('idx_candidates_entity').on(t.entityId)]);
export const attributeOverrides=sqliteTable('attribute_overrides',{
 id:text('id').primaryKey(),entityId:text('entity_id').notNull(),field:text('field').notNull(),payload:text('payload').notNull(),candidateId:text('candidate_id').notNull(),updatedAt:text('updated_at').notNull()
},t=>[index('idx_attribute_overrides_entity').on(t.entityId)]);
export const reviewEvents=sqliteTable('review_events',{
 id:text('id').primaryKey(),candidateId:text('candidate_id').notNull(),action:text('action').notNull(),note:text('note').notNull(),createdAt:text('created_at').notNull()
},t=>[index('idx_review_events_candidate').on(t.candidateId)]);

// Immutable approval preimages; only revertedBy changes after an audited undo.
export const approvalSnapshots=sqliteTable('approval_snapshots',{
 eventId:text('event_id').primaryKey(),candidateId:text('candidate_id').notNull(),entityId:text('entity_id').notNull(),field:text('field').notNull(),beforeOverride:text('before_override'),afterOverride:text('after_override').notNull(),basePayload:text('base_payload').notNull(),revertedBy:text('reverted_by'),createdAt:text('created_at').notNull()
},t=>[index('idx_approval_snapshots_candidate').on(t.candidateId)]);
