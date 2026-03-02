/**
 * API Request Validation Schemas
 *
 * Using Zod for runtime type validation and error messages.
 * Prevents injection attacks and data corruption.
 */

import { z } from 'zod';

// ==========================================
// KMS Validation Schemas
// ==========================================

/**
 * Valid relationship types from DSPy inferencer
 */
const VALID_RELATIONSHIP_TYPES = ['blocks', 'impacts', 'depends_on', 'related_to'] as const;

/**
 * Valid KMS item types
 */
const VALID_KMS_TYPES = ['decision', 'action', 'commitment', 'risk'] as const;

/**
 * UUID validation helper
 * RFC 4122 compliant UUIDs
 */
const uuidSchema = z
  .string()
  .uuid('Must be a valid UUID')
  .describe('Valid RFC 4122 UUID');

/**
 * Schema for POST /api/kms/validate
 * Validates a relationship between KMS items
 */
export const validateRelationshipSchema = z.object({
  relationshipId: uuidSchema.describe('UUID of the inferred relationship'),
  validated: z
    .boolean()
    .describe('Whether the relationship is confirmed as valid'),
  userFeedback: z
    .string()
    .max(500, 'Feedback must be 500 characters or less')
    .optional()
    .describe('Optional human feedback on the relationship'),
});

export type ValidateRelationshipRequest = z.infer<typeof validateRelationshipSchema>;

/**
 * Schema for validating an inferred relationship record
 * Used internally to validate relationship data
 */
export const inferencedRelationshipSchema = z.object({
  id: uuidSchema,
  fromId: uuidSchema.describe('Source KMS item ID'),
  toId: uuidSchema.describe('Target KMS item ID'),
  fromType: z
    .enum(VALID_KMS_TYPES)
    .describe('Type of source KMS item'),
  toType: z
    .enum(VALID_KMS_TYPES)
    .describe('Type of target KMS item'),
  relationshipType: z
    .enum(VALID_RELATIONSHIP_TYPES)
    .describe('Type of relationship between items'),
  confidence: z
    .number()
    .min(0, 'Confidence must be between 0 and 1')
    .max(1, 'Confidence must be between 0 and 1')
    .describe('AI confidence in this relationship (0-1)'),
  inferenceReasoning: z
    .string()
    .optional()
    .describe('Why the relationship was inferred'),
  validated: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether human has confirmed this relationship'),
});

export type InferencedRelationship = z.infer<typeof inferencedRelationshipSchema>;

/**
 * Schema for validating a KMS Decision
 */
export const kmsDecisionSchema = z.object({
  id: uuidSchema,
  text: z
    .string()
    .min(1, 'Decision text cannot be empty')
    .max(2000, 'Decision text must be 2000 characters or less')
    .describe('The decision made'),
  owner: z
    .string()
    .min(1, 'Owner cannot be empty')
    .max(100, 'Owner name must be 100 characters or less')
    .optional()
    .describe('Person responsible for the decision'),
  date: z
    .string()
    .datetime()
    .optional()
    .describe('When the decision was made'),
  status: z
    .enum(['active', 'superseded', 'archived'])
    .optional()
    .default('active')
    .describe('Current status of the decision'),
});

export type KMSDecision = z.infer<typeof kmsDecisionSchema>;

/**
 * Schema for validating a KMS Action Item
 */
export const kmsActionItemSchema = z.object({
  id: uuidSchema,
  text: z
    .string()
    .min(1, 'Action text cannot be empty')
    .max(2000, 'Action text must be 2000 characters or less')
    .describe('The action to be taken'),
  owner: z
    .string()
    .min(1, 'Owner cannot be empty')
    .max(100, 'Owner name must be 100 characters or less')
    .optional()
    .describe('Person responsible for the action'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format')
    .optional()
    .describe('When the action is due'),
  status: z
    .enum(['not-started', 'in-progress', 'blocked', 'completed'])
    .optional()
    .default('not-started')
    .describe('Current status of the action'),
  blockedBy: z
    .array(uuidSchema)
    .optional()
    .describe('IDs of other actions that block this one'),
});

export type KMSActionItem = z.infer<typeof kmsActionItemSchema>;

/**
 * Schema for validating a KMS Commitment
 */
export const kmsCommitmentSchema = z.object({
  id: uuidSchema,
  text: z
    .string()
    .min(1, 'Commitment text cannot be empty')
    .max(2000, 'Commitment text must be 2000 characters or less')
    .describe('The commitment made'),
  owner: z
    .string()
    .min(1, 'Owner cannot be empty')
    .max(100, 'Owner name must be 100 characters or less')
    .optional()
    .describe('Person who made the commitment'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format')
    .optional()
    .describe('When the commitment is due'),
  status: z
    .enum(['pending', 'in-progress', 'fulfilled', 'broken'])
    .optional()
    .default('pending')
    .describe('Current status of the commitment'),
});

export type KMSCommitment = z.infer<typeof kmsCommitmentSchema>;

/**
 * Schema for validating a KMS Risk
 */
export const kmsRiskSchema = z.object({
  id: uuidSchema,
  text: z
    .string()
    .min(1, 'Risk text cannot be empty')
    .max(2000, 'Risk text must be 2000 characters or less')
    .describe('Description of the risk'),
  severity: z
    .enum(['low', 'medium', 'high', 'critical'])
    .optional()
    .default('medium')
    .describe('Severity level of the risk'),
  mitigation: z
    .string()
    .max(2000, 'Mitigation must be 2000 characters or less')
    .optional()
    .describe('How to mitigate this risk'),
  status: z
    .enum(['identified', 'monitoring', 'mitigated', 'occurred'])
    .optional()
    .default('identified')
    .describe('Current status of the risk'),
});

export type KMSRisk = z.infer<typeof kmsRiskSchema>;

/**
 * Utility function to safely parse JSON with schema validation
 * Returns parsed data or throws with descriptive error
 */
export function validateAndParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = (error as any).issues
        .map((issue: any) => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ');
      throw new Error(`${context} validation failed: ${messages}`);
    }
    throw error;
  }
}

/**
 * Utility function for safe parsing with fallback to null
 * Used when rejecting invalid data silently
 */
export function tryValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T | null {
  try {
    return schema.parse(data);
  } catch {
    return null;
  }
}
