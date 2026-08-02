/**
 * Shared image-picking utilities.
 *
 * iOS-specific issues this resolves:
 * 1. On iOS, launching a picker from inside an Alert callback causes the
 *    picker to silently fail or dismiss immediately — the modal/alert
 *    dismissal animation conflicts with UIImagePickerController presentation.
 *    Fix: call pickers directly, never from inside Alert.alert() callbacks.
 *
 * 2. On iOS 14+ the photo library permission can return 'limited' (partial
 *    access) — we treat that as granted so the picker still opens.
 *
 * 3. Camera permission must be explicitly requested before launchCameraAsync.
 *
 * 4. Wrapping everything in try/catch prevents unhandled rejections when
 *    the user force-dismisses the system picker.
 */

import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * Ask for photo library permission and open the gallery.
 * Returns the selected URI string, or null if cancelled/denied.
 */
export async function pickImageFromGallery({ quality = 0.8, allowsEditing = false } = {}) {
  try {
    // Request permission first — required on iOS, no-op on Android
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // 'limited' counts as granted on iOS 14+ (user gave partial access)
    if (status !== 'granted' && status !== 'limited') {
      Alert.alert(
        'Photos access required',
        'Go to Settings → Privacy → Photos and allow access for this app.',
        [{ text: 'OK' }]
      );
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing,
      quality,
    });

    if (result.canceled || !result.assets?.length) return null;
    return result.assets[0].uri;
  } catch (e) {
    console.warn('pickImageFromGallery error:', e);
    return null;
  }
}

/**
 * Ask for camera permission and launch the camera.
 * Returns the captured URI string, or null if cancelled/denied.
 */
export async function pickImageFromCamera({ quality = 0.8, allowsEditing = true } = {}) {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera access required',
        'Go to Settings → Privacy → Camera and allow access for this app.',
        [{ text: 'OK' }]
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing,
      quality,
    });

    if (result.canceled || !result.assets?.length) return null;
    return result.assets[0].uri;
  } catch (e) {
    console.warn('pickImageFromCamera error:', e);
    return null;
  }
}

/**
 * Shows "Camera / Gallery / Cancel" choice then opens the chosen picker.
 *
 * On iOS we CANNOT open a picker from inside an Alert callback — the system
 * picker (UIImagePickerController) requires the presenting view controller to
 * be fully settled before it can be pushed. Calling it from an Alert callback
 * fires before the alert has finished dismissing, which silently fails.
 *
 * Fix: use ActionSheetIOS on iOS (no intermediate dismiss animation), and
 * fall back to a two-step state machine approach on Android where Alert is safe.
 *
 * @param {function} onUri  Called with the selected URI (string) or null.
 */
export function showImageSourcePicker(onUri) {
  if (Platform.OS === 'ios') {
    const { ActionSheetIOS } = require('react-native');
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Take Photo', 'Choose from Library'],
        cancelButtonIndex: 0,
      },
      (buttonIndex) => {
        // Delay on iOS so the action sheet fully dismisses before
        // UIImagePickerController tries to present — prevents silent failures
        // when called from inside a Modal (sheet is still animating out).
        setTimeout(async () => {
          if (buttonIndex === 1) {
            onUri(await pickImageFromCamera());
          } else if (buttonIndex === 2) {
            onUri(await pickImageFromGallery());
          }
        }, 300);
      }
    );
  } else {
    Alert.alert(
      'Attach Receipt',
      'Choose source',
      [
        { text: 'Camera',  onPress: async () => { onUri(await pickImageFromCamera()); } },
        { text: 'Gallery', onPress: async () => { onUri(await pickImageFromGallery()); } },
        { text: 'Cancel',  style: 'cancel', onPress: () => onUri(null) },
      ]
    );
  }
}
