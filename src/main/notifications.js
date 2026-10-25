const { Notification, app } = require('electron');

/**
 * Sends a native desktop notification if supported by the OS environment.
 * Safely handles environments where notifications are unavailable or permissions are denied.
 */
function sendNotification({ title, body, silent = false }, CustomNotification = null) {
  const NotifClass = CustomNotification || Notification;
  try {
    if (!NotifClass || (typeof NotifClass.isSupported === 'function' && !NotifClass.isSupported())) {
      console.log(`[Notification Fallback] Notifications not supported: ${title} - ${body}`);
      return false;
    }

    const notification = new NotifClass({
      title: title || 'Productivity Manager',
      body: body || '',
      silent: Boolean(silent)
    });

    if (typeof notification.show === 'function') {
      notification.show();
    }
    console.log(`[Notification] Displayed: "${title}" - "${body}"`);
    return true;
  } catch (err) {
    console.warn('[Notification Error] Failed to display native notification:', err.message);
    return false;
  }
}

module.exports = {
  sendNotification
};
