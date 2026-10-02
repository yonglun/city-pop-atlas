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
