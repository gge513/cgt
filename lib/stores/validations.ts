'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Validation state for inferred relationships
 * Tracks which relationships have been validated by the user
 */
interface ValidationState {
  // Track validated relationships
  validatedIds: Set<string>;
  rejectedIds: Set<string>;

  // Actions
  markValid: (relationshipId: string) => Promise<void>;
  markRejected: (relationshipId: string) => Promise<void>;
  isValidated: (relationshipId: string) => boolean;
  isRejected: (relationshipId: string) => boolean;
  clearValidation: (relationshipId: string) => void;
  reset: () => void;
}

/**
 * Zustand store for managing relationship validation state
 * Persists to localStorage for client-side state management
 */
export const useValidationStore = create<ValidationState>()(
  persist(
    (set, get) => ({
      validatedIds: new Set(),
      rejectedIds: new Set(),

      /**
       * Mark a relationship as valid (user confirmed)
       * Persists the validation to localStorage
       */
      markValid: async (relationshipId: string) => {
        set((state) => {
          const newValidatedIds = new Set(state.validatedIds);
          const newRejectedIds = new Set(state.rejectedIds);

          newValidatedIds.add(relationshipId);
          newRejectedIds.delete(relationshipId); // Remove from rejected if it was

          return {
            validatedIds: newValidatedIds,
            rejectedIds: newRejectedIds,
          };
        });

        // Optionally persist to backend
        try {
          await fetch('/api/kms/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              relationshipId,
              validated: true,
            }),
          });
        } catch (error) {
          console.error('Failed to persist validation to backend:', error);
          // Continue anyway - local state is still updated
        }
      },

      /**
       * Mark a relationship as rejected (user disagreed)
       * Persists the rejection to localStorage
       */
      markRejected: async (relationshipId: string) => {
        set((state) => {
          const newValidatedIds = new Set(state.validatedIds);
          const newRejectedIds = new Set(state.rejectedIds);

          newRejectedIds.add(relationshipId);
          newValidatedIds.delete(relationshipId); // Remove from validated if it was

          return {
            validatedIds: newValidatedIds,
            rejectedIds: newRejectedIds,
          };
        });

        // Optionally persist to backend
        try {
          await fetch('/api/kms/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              relationshipId,
              validated: false,
            }),
          });
        } catch (error) {
          console.error('Failed to persist rejection to backend:', error);
          // Continue anyway - local state is still updated
        }
      },

      /**
       * Check if a relationship has been validated
       */
      isValidated: (relationshipId: string) => {
        return get().validatedIds.has(relationshipId);
      },

      /**
       * Check if a relationship has been rejected
       */
      isRejected: (relationshipId: string) => {
        return get().rejectedIds.has(relationshipId);
      },

      /**
       * Clear validation state for a specific relationship
       */
      clearValidation: (relationshipId: string) => {
        set((state) => {
          const newValidatedIds = new Set(state.validatedIds);
          const newRejectedIds = new Set(state.rejectedIds);

          newValidatedIds.delete(relationshipId);
          newRejectedIds.delete(relationshipId);

          return {
            validatedIds: newValidatedIds,
            rejectedIds: newRejectedIds,
          };
        });
      },

      /**
       * Reset all validations
       */
      reset: () => {
        set({
          validatedIds: new Set(),
          rejectedIds: new Set(),
        });
      },
    }),
    {
      name: 'validation-store',
      storage: {
        getItem: (name: string) => {
          const item = localStorage.getItem(name);
          if (!item) return null;

          const parsed = JSON.parse(item);
          return {
            state: {
              validatedIds: new Set(parsed.state?.validatedIds || []),
              rejectedIds: new Set(parsed.state?.rejectedIds || []),
            },
            version: parsed.version,
          };
        },
        setItem: (name: string, value: any) => {
          const toStore = {
            state: {
              validatedIds: Array.from(value.state.validatedIds),
              rejectedIds: Array.from(value.state.rejectedIds),
            },
            version: value.version,
          };
          localStorage.setItem(name, JSON.stringify(toStore));
        },
        removeItem: (name: string) => {
          localStorage.removeItem(name);
        },
      },
    }
  )
);
