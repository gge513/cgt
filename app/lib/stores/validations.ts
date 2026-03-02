import { create } from 'zustand';

interface ValidationState {
  validated: Set<string>;
  rejected: Set<string>;
  isLoading: boolean;

  // Actions
  markValid: (relationshipId: string) => Promise<void>;
  markRejected: (relationshipId: string) => Promise<void>;
  loadValidations: () => Promise<void>;
  isValidated: (relationshipId: string) => boolean;
  isRejected: (relationshipId: string) => boolean;
}

export const useValidationStore = create<ValidationState>((set, get) => ({
  validated: new Set(),
  rejected: new Set(),
  isLoading: false,

  markValid: async (relationshipId: string) => {
    try {
      set({ isLoading: true });

      const response = await fetch('/api/kms/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relationshipId,
          validated: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save validation');
      }

      // Update local state
      set((state) => {
        const validated = new Set(state.validated);
        validated.add(relationshipId);
        const rejected = new Set(state.rejected);
        rejected.delete(relationshipId);
        return { validated, rejected, isLoading: false };
      });
    } catch (error) {
      console.error('Error marking relationship as valid:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  markRejected: async (relationshipId: string) => {
    try {
      set({ isLoading: true });

      const response = await fetch('/api/kms/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relationshipId,
          validated: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save validation');
      }

      // Update local state
      set((state) => {
        const rejected = new Set(state.rejected);
        rejected.add(relationshipId);
        const validated = new Set(state.validated);
        validated.delete(relationshipId);
        return { validated, rejected, isLoading: false };
      });
    } catch (error) {
      console.error('Error marking relationship as rejected:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  loadValidations: async () => {
    try {
      set({ isLoading: true });

      const response = await fetch('/api/kms/validate');
      if (!response.ok) {
        throw new Error('Failed to load validations');
      }

      const data = await response.json();
      const validated = new Set<string>();
      const rejected = new Set<string>();

      data.validations.forEach((v: any) => {
        if (v.validated) {
          validated.add(v.relationshipId);
        } else {
          rejected.add(v.relationshipId);
        }
      });

      set({ validated, rejected, isLoading: false });
    } catch (error) {
      console.error('Error loading validations:', error);
      set({ isLoading: false });
    }
  },

  isValidated: (relationshipId: string) => {
    return get().validated.has(relationshipId);
  },

  isRejected: (relationshipId: string) => {
    return get().rejected.has(relationshipId);
  },
}));
