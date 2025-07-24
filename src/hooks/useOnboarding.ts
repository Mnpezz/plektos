import { useEffect, useRef, useMemo } from 'react';
import { useCurrentUser } from './useCurrentUser';

export interface OnboardingState {
  hasCompletedOnboarding: boolean;
  currentStep: number;
  skippedSteps: number[];
}

const defaultOnboardingState: OnboardingState = {
  hasCompletedOnboarding: false,
  currentStep: 0,
  skippedSteps: [],
};

export function useOnboarding() {
  const { user } = useCurrentUser();
  const previousUserRef = useRef<string | undefined>();

  // Create stable keys that don't change during the session
  const onboardingKey = useMemo(() => `plektos-onboarding-${user?.pubkey || 'default'}`, [user?.pubkey]);
  const interactionKey = useMemo(() => `plektos-user-interacted-${user?.pubkey || 'default'}`, [user?.pubkey]);

  // Get onboarding state from localStorage
  const getOnboardingState = (): OnboardingState => {
    try {
      const stored = localStorage.getItem(onboardingKey);
      return stored ? JSON.parse(stored) : defaultOnboardingState;
    } catch {
      return defaultOnboardingState;
    }
  };

  // Set onboarding state to localStorage
  const setOnboardingState = (state: OnboardingState) => {
    try {
      localStorage.setItem(onboardingKey, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save onboarding state:', error);
    }
  };

  // Get user interaction state from localStorage
  const getUserHasInteracted = (): boolean => {
    try {
      const stored = localStorage.getItem(interactionKey);
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  };

  // Set user interaction state to localStorage
  const setUserHasInteracted = (hasInteracted: boolean) => {
    try {
      localStorage.setItem(interactionKey, JSON.stringify(hasInteracted));
    } catch (error) {
      console.warn('Failed to save user interaction state:', error);
    }
  };

  // Handle migration when user logs in (from 'default' to user-specific keys)
  useEffect(() => {
    const currentUserPubkey = user?.pubkey;
    const previousUserPubkey = previousUserRef.current;

    // If user just logged in (went from undefined to having a pubkey)
    if (!previousUserPubkey && currentUserPubkey) {
      const defaultOnboardingKey = 'plektos-onboarding-default';
      const defaultInteractionKey = 'plektos-user-interacted-default';

      // Check if there's data in the default keys
      const defaultOnboardingData = localStorage.getItem(defaultOnboardingKey);
      const defaultInteractionData = localStorage.getItem(defaultInteractionKey);

      if (defaultOnboardingData) {
        try {
          // Only migrate if the user-specific key doesn't already have data
          const userSpecificData = localStorage.getItem(onboardingKey);
          if (!userSpecificData) {
            localStorage.setItem(onboardingKey, defaultOnboardingData);
            if (process.env.NODE_ENV === 'development') {
              console.log('Migrated onboarding data from default to user-specific key');
            }
          }
        } catch (error) {
          console.warn('Failed to migrate onboarding data:', error);
        }
      }

      if (defaultInteractionData) {
        try {
          // Only migrate if the user-specific key doesn't already have data
          const userSpecificData = localStorage.getItem(interactionKey);
          if (!userSpecificData) {
            localStorage.setItem(interactionKey, defaultInteractionData);
            if (process.env.NODE_ENV === 'development') {
              console.log('Migrated interaction data from default to user-specific key');
            }
          }
        } catch (error) {
          console.warn('Failed to migrate interaction data:', error);
        }
      }
    }

    // Update the ref for next time
    previousUserRef.current = currentUserPubkey;
  }, [user?.pubkey, onboardingKey, interactionKey]);

  const completeOnboarding = () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('completeOnboarding called for user:', user?.pubkey?.slice(0, 8) + '...');
    }
    const currentState = getOnboardingState();
    setOnboardingState({
      ...currentState,
      hasCompletedOnboarding: true,
    });
    // Mark that this user has interacted with the app
    setUserHasInteracted(true);
  };

  const nextStep = () => {
    const currentState = getOnboardingState();
    setOnboardingState({
      ...currentState,
      currentStep: currentState.currentStep + 1,
    });
  };

  const previousStep = () => {
    const currentState = getOnboardingState();
    setOnboardingState({
      ...currentState,
      currentStep: Math.max(0, currentState.currentStep - 1),
    });
  };

  const skipStep = (stepIndex: number) => {
    const currentState = getOnboardingState();
    setOnboardingState({
      ...currentState,
      skippedSteps: [...currentState.skippedSteps, stepIndex],
      currentStep: currentState.currentStep + 1,
    });
    // Mark that this user has interacted with the app
    setUserHasInteracted(true);
  };

  const resetOnboarding = () => {
    setOnboardingState(defaultOnboardingState);
    setUserHasInteracted(false);
  };

  const markUserAsInteracted = () => {
    setUserHasInteracted(true);
  };

  // Get current state
  const onboardingState = getOnboardingState();
  const userHasInteracted = getUserHasInteracted();

  // Determine if we should show onboarding - rely solely on localStorage
  const shouldShowOnboarding = (() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('shouldShowOnboarding calculation:', {
        hasUser: !!user,
        userPubkey: user?.pubkey?.slice(0, 8) + '...',
        onboardingKey,
        interactionKey,
        hasCompletedOnboarding: onboardingState.hasCompletedOnboarding,
        userHasInteracted,
        onboardingState,
      });
    }

    // Must have a user to show onboarding
    if (!user) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Not showing onboarding: no user');
      }
      return false;
    }

    // If user has completed onboarding, never show it again
    if (onboardingState.hasCompletedOnboarding) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Not showing onboarding: already completed', {
          hasCompletedOnboarding: onboardingState.hasCompletedOnboarding,
          onboardingState
        });
      }
      return false;
    }

    // If this user has already interacted with the app meaningfully, don't show onboarding
    if (userHasInteracted) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Not showing onboarding: user has already interacted');
      }
      return false;
    }

    // For new users who haven't completed onboarding or interacted, show onboarding
    if (process.env.NODE_ENV === 'development') {
      console.log('Showing onboarding: new user');
    }
    return true;
  })();

  // Debug logging (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Onboarding Debug:', {
        user: !!user,
        userPubkey: user?.pubkey?.slice(0, 8) + '...',
        hasCompletedOnboarding: onboardingState.hasCompletedOnboarding,
        userHasInteracted,
        shouldShowOnboarding,
      });

      // Add global helpers for debugging
      (window as {
        resetPlektosOnboarding?: () => void;
        checkPlektosOnboarding?: () => void;
      }).resetPlektosOnboarding = () => {
        localStorage.removeItem(onboardingKey);
        localStorage.removeItem(interactionKey);
        console.log('Onboarding state cleared! Refresh the page.');
      };

      (window as {
        resetPlektosOnboarding?: () => void;
        checkPlektosOnboarding?: () => void;
      }).checkPlektosOnboarding = () => {
        const onboardingData = localStorage.getItem(onboardingKey);
        const interactionData = localStorage.getItem(interactionKey);
        console.log('Current localStorage state:', {
          onboardingKey,
          interactionKey,
          onboardingData: onboardingData ? JSON.parse(onboardingData) : null,
          interactionData: interactionData ? JSON.parse(interactionData) : null,
          shouldShow: shouldShowOnboarding,
        });
      };
    }
  }, [user, onboardingState.hasCompletedOnboarding, userHasInteracted, shouldShowOnboarding, interactionKey, onboardingKey]);

  return {
    onboardingState,
    shouldShowOnboarding,
    completeOnboarding,
    nextStep,
    previousStep,
    skipStep,
    resetOnboarding,
    markUserAsInteracted,
    // Debug helpers
    userHasInteracted,
    debugInfo: {
      user: !!user,
      hasCompletedOnboarding: onboardingState.hasCompletedOnboarding,
      userHasInteracted,
    }
  };
} 