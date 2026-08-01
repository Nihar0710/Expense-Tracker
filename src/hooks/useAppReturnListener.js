import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Fires `onReturn` the moment the app comes back to the foreground
 * AFTER `armWatch()` was called. This is how we detect "user just
 * came back from GPay/PhonePe after (maybe) paying".
 *
 * NOTE: On some heavily-customized Android OEM skins, the foreground
 * event can be delayed or occasionally missed. Always pair this with
 * a persistent "Pending Payments" banner as a fallback so nothing
 * silently gets lost.
 */
export function useAppReturnListener(onReturn) {
  const armed = useRef(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const cameToForeground =
        appState.current.match(/inactive|background/) && nextState === 'active';

      if (cameToForeground && armed.current) {
        armed.current = false;
        onReturn();
      }

      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [onReturn]);

  // Call this right before you open the UPI deep link.
  const armWatch = () => {
    armed.current = true;
  };

  return { armWatch };
}
