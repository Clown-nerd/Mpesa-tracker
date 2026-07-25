import { Platform, PermissionsAndroid, DeviceEventEmitter } from 'react-native';
import { parseMpesaSms, isMpesaMessage } from './mpesaParser';
import { saveTransaction, getProcessedSmsIds, addProcessedSmsId } from './storage';
import { applyLearnedCategory } from './categoryLearning';
// TODO: uncomment the notification call below once EAS / expo-notifications is
// fully configured with a physical device and push credentials.
// import * as Notifications from 'expo-notifications';

/**
 * Request READ_SMS and RECEIVE_SMS permissions on Android.
 * Returns true if granted.
 */
export async function requestSmsPermissions() {
  if (Platform.OS !== 'android') return false;
  try {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    ]);
    return (
      granted[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED &&
      granted[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch (e) {
    console.warn('SMS permission request failed:', e);
    return false;
  }
}

/**
 * Process messages in chunks to prevent blocking the JS thread.
 */
async function processInChunks(messages, processedIds, onProgress) {
  const CHUNK_SIZE = 20;
  const newTransactions = [];
  
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    
    for (const sms of chunk) {
      const smsId = String(sms._id);
      if (processedIds.includes(smsId)) continue;

      if (!isMpesaMessage(sms.body, sms.address)) {
        await addProcessedSmsId(smsId);
        continue;
      }

      let parsed = parseMpesaSms(sms.body, sms.address, new Date(parseInt(sms.date, 10)));
      if (parsed) {
        parsed = await applyLearnedCategory(parsed);
        const saved = await saveTransaction(parsed);
        if (saved) newTransactions.push(parsed);
      }
      await addProcessedSmsId(smsId);
    }
    
    // Yield to JS thread between chunks
    await new Promise(r => setTimeout(r, 0));
    
    if (onProgress) {
      onProgress({
        processed: Math.min(i + CHUNK_SIZE, messages.length),
        total: messages.length,
        newFound: newTransactions.length,
      });
    }
  }
  return newTransactions;
}

/**
 * Read existing SMS inbox for M-Pesa messages using react-native-get-sms-android.
 * Returns an array of newly saved transactions.
 */
export async function readExistingSms(maxCount = 200, onProgress = null) {
  if (Platform.OS !== 'android') return [];

  let SmsAndroid;
  try {
    SmsAndroid = require('react-native-get-sms-android').default;
  } catch (e) {
    console.warn('react-native-get-sms-android not available (needs dev build):', e.message);
    return [];
  }

  const processedIds = await getProcessedSmsIds();

  if (processedIds.length === 0) {
    // First launch: cap at 150 to keep initial sync fast
    maxCount = 150;
  }

  return new Promise((resolve) => {
    const filter = {
      box: 'inbox',
      maxCount,
      address: 'MPESA',
    };

    SmsAndroid.list(
      JSON.stringify(filter),
      (fail) => {
        console.warn('SMS read failed:', fail);
        resolve([]);
      },
      async (count, smsList) => {
        const messages = JSON.parse(smsList);
        const newTransactions = await processInChunks(messages, processedIds, onProgress);
        resolve(newTransactions);
      }
    );
  });
}

// ─── Real-time SMS listener ───────────────────────────────────────────────────

/**
 * Internal ref that tracks the active DeviceEventEmitter subscription so
 * stopSmsListener() can clean it up.
 * @type {{ subscription: import('react-native').EmitterSubscription | null }}
 */
const _listenerState = { subscription: null };

/**
 * Build the notification body for a parsed M-Pesa transaction.
 * Returns a string like "-KES 500 to John Doe" or "+KES 1,200 from Employer".
 */
function _buildNotificationBody(parsed) {
  const sign   = parsed.isIncome ? '+' : '-';
  const amount = parsed.amount.toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const party  = parsed.party || (parsed.isIncome ? 'unknown sender' : 'unknown');
  const prep   = parsed.isIncome ? 'from' : 'to';
  return `${sign}KES ${amount} ${prep} ${party}`;
}

/**
 * Start listening for incoming M-Pesa SMS messages in real-time.
 *
 * Uses react-native-get-sms-android's SmsAndroid.startReceive() to register
 * an Android broadcast receiver, then listens for 'sms_received' events on
 * the React Native DeviceEventEmitter bridge.
 *
 * Call this once on app mount (after permissions have been granted).
 * Returns a cleanup function — call it on unmount, or use stopSmsListener().
 */
export function startSmsListener() {
  if (Platform.OS !== 'android') return () => {};

  let SmsAndroid;
  try {
    SmsAndroid = require('react-native-get-sms-android').default;
  } catch (e) {
    console.warn('[SmsListener] react-native-get-sms-android not available:', e.message);
    return () => {};
  }

  // Register the native broadcast receiver that surfaces events to JS.
  if (typeof SmsAndroid.startReceive === 'function') {
    SmsAndroid.startReceive();
  }

  // Guard against stale double-registration.
  if (_listenerState.subscription) {
    _listenerState.subscription.remove();
    _listenerState.subscription = null;
  }

  const subscription = DeviceEventEmitter.addListener(
    'sms_received',
    async (event) => {
      try {
        const { originatingAddress: sender = '', body = '', timestamp } = event;

        // Quick filter — skip obviously non-M-Pesa messages early.
        if (!isMpesaMessage(body, sender)) return;

        // Use the native message _id when present; fall back to a timestamp hash.
        // react-native-get-sms-android surfaces it as event._id or event.id.
        const smsId = String(event._id ?? event.id ?? `live-${timestamp ?? Date.now()}`);

        // Dedup: skip if we've already processed this SMS.
        const processedIds = await getProcessedSmsIds();
        if (processedIds.includes(smsId)) return;

        // Mark processed early to prevent concurrent duplicate processing.
        await addProcessedSmsId(smsId);

        const date = timestamp ? new Date(Number(timestamp)) : new Date();
        let parsed = parseMpesaSms(body, sender, date);
        if (!parsed) return;

        parsed = await applyLearnedCategory(parsed);
        const saved = await saveTransaction(parsed);

        if (saved) {
          const notifBody = _buildNotificationBody(parsed);
          console.log('[SmsListener] New M-Pesa transaction captured:', notifBody);

          // TODO: Enable this block once expo-notifications is configured with
          // EAS and a physical device (push credentials required).
          //
          // await Notifications.scheduleNotificationAsync({
          //   content: {
          //     title: 'New M-Pesa transaction',
          //     body:  notifBody,
          //     sound: true,
          //   },
          //   trigger: null, // fire immediately
          // });
        }
      } catch (err) {
        console.error('[SmsListener] Error processing incoming SMS:', err);
      }
    }
  );

  _listenerState.subscription = subscription;

  // Return a cleanup function so callers can use it directly if preferred.
  return () => stopSmsListener();
}

/**
 * Stop the real-time SMS listener and unregister the native broadcast receiver.
 * Safe to call even if the listener was never started.
 */
export function stopSmsListener() {
  if (Platform.OS !== 'android') return;

  if (_listenerState.subscription) {
    _listenerState.subscription.remove();
    _listenerState.subscription = null;
  }

  let SmsAndroid;
  try {
    SmsAndroid = require('react-native-get-sms-android').default;
  } catch {
    return;
  }

  if (typeof SmsAndroid.stopReceive === 'function') {
    SmsAndroid.stopReceive();
  }
}
